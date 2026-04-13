/**
 * Delta Mapper
 *
 * Dos responsabilidades:
 * 1. parseDataSet(xml, tag?)  → convierte XML .NET DataSet en array de objetos JS
 * 2. map*(rows)               → transforma esos objetos en schema normalizado GDS
 *
 * Campos reales confirmados por respuesta live de la API Delta.
 */

const { XMLParser } = require("fast-xml-parser");

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false, // mantiene los valores como strings
});

function _findElement(obj, name) {
  if (!obj || typeof obj !== "object") return null;
  if (obj[name] !== undefined) return obj[name];
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "object") {
      const found = _findElement(obj[key], name);
      if (found !== null) return found;
    }
  }
  return null;
}

/**
 * Convierte el XML de un .NET DataSet en un array de filas JS.
 *
 * @param {string} xml
 * @param {string} [tableTag] - Tag específico de tabla a extraer.
 *   Si el DataSet tiene múltiples tablas (ej: ServiciosxDiaId y ServiciosxDiaId1),
 *   pasá el tag que querés. Si omitís, toma el primero.
 * @returns {Array<object>}
 */
function parseDataSet(xml, tableTag = null) {
  if (!xml || typeof xml !== "string") return [];

  let parsed;
  try {
    parsed = parser.parse(xml);
  } catch (err) {
    console.error("[parseDataSet] PARSE ERROR:", err);
    return [];
  }

  if (!parsed) return [];

  // Para respuestas primitivas: int, double, string
  const primitiveInt = _findElement(parsed, "int");
  if (primitiveInt !== null) return [{ _value: String(primitiveInt).trim() }];
  const primitiveDouble = _findElement(parsed, "double");
  if (primitiveDouble !== null)
    return [{ _value: String(primitiveDouble).trim() }];
  const primitiveString = _findElement(parsed, "string");
  if (primitiveString !== null)
    return [{ _value: String(primitiveString).trim() }];

  // Extraer bloque diffgram
  const diffgram = _findElement(parsed, "diffgr:diffgram");
  if (!diffgram) return [];

  // Extraer contenido del documento raíz
  const contentElement =
    diffgram.NewDataSet || diffgram.DocumentElement || diffgram.DataSetError;
  if (!contentElement) return [];

  // Si el API devolvió un error (ej. auth inválida), extraerlo y lanzarlo
  // para que no se oculte silenciosamente como un array vacío "trips: []"
  if (contentElement.TablaError) {
    const errorData = Array.isArray(contentElement.TablaError)
      ? contentElement.TablaError[0]
      : contentElement.TablaError;
    const desc =
      errorData && errorData.Descripcion
        ? String(errorData.Descripcion).trim()
        : "Error devuelto por Delta";
    throw new Error(`Delta API: ${desc}`);
  }

  // Determinar tag de fila: el pasado por parámetro, o el primero que aparezca
  let rowTag = tableTag;
  if (!rowTag) {
    rowTag = Object.keys(contentElement).find(
      (k) => k !== "xs:schema" && !k.startsWith("?"),
    );
  }

  let rows = [];
  if (rowTag && contentElement[rowTag]) {
    const data = contentElement[rowTag];
    rows = Array.isArray(data) ? data : [data];
  }

  // Aplanar los valores a String para mantener compatibilidad con el old mapper
  return rows.map((r) => {
    const finalRow = {};
    if (r && typeof r === "object") {
      for (const k of Object.keys(r)) {
        if (typeof r[k] === "object") {
          // Ignorar nodos anidados complejos o vacíos
          finalRow[k] = "";
        } else {
          finalRow[k] = r[k] != null ? String(r[k]).trim() : "";
        }
      }
    }
    return finalRow;
  });
}

function parseDataSetAll(xml) {
  if (!xml || typeof xml !== "string") return {};

  let parsed;
  try {
    parsed = parser.parse(xml);
  } catch (err) {
    return {};
  }

  if (!parsed) return {};

  const diffgram = _findElement(parsed, "diffgr:diffgram");
  if (!diffgram) return {};

  const contentElement =
    diffgram.NewDataSet || diffgram.DocumentElement || diffgram.DataSetError;
  if (!contentElement) return {};

  if (contentElement.TablaError) {
    const errorData = Array.isArray(contentElement.TablaError)
      ? contentElement.TablaError[0]
      : contentElement.TablaError;
    const desc =
      errorData && errorData.Descripcion
        ? String(errorData.Descripcion).trim()
        : "Error devuelto por Delta";
    throw new Error(`Delta API: ${desc}`);
  }

  const result = {};
  for (const key of Object.keys(contentElement)) {
    if (key === "xs:schema" || key.startsWith("?")) continue;
    const data = contentElement[key];
    const rows = Array.isArray(data) ? data : [data];
    result[key] = rows.map((r) => {
      const finalRow = {};
      if (r && typeof r === "object") {
        for (const k of Object.keys(r)) {
          if (typeof r[k] === "object") {
            finalRow[k] = "";
          } else {
            finalRow[k] = r[k] != null ? String(r[k]).trim() : "";
          }
        }
      }
      return finalRow;
    });
  }
  return result;
}

/**
 * Parsea respuestas de tipo primitivo directo (int, double, string)
 */
function parsePrimitive(xml) {
  const rows = parseDataSet(xml);
  if (rows.length && rows[0]._value !== undefined) return rows[0]._value;
  return null;
}

// ─── Códigos de calidad (confirmados) ─────────────────────────────────────────
const CALIDAD_MAP = {
  CA: "cama",
  SE: "semi-cama",
  CI: "coche-integral",
  EC: "ejecutivo",
  PL: "pullman",
  CO: "comun",
};

function mapCalidad(cod) {
  if (!cod) return "standard";
  return CALIDAD_MAP[String(cod).toUpperCase().trim()] || cod.toLowerCase();
}

// ─── Mappers por operación ────────────────────────────────────────────────────

/**
 * ObtenerServicios → trips[]
 *
 * Campos reales del DataSet:
 *   Id            → ID del servicio (usar como serviceId)
 *   Emp           → código empresa
 *   Cod           → código de servicio/línea
 *   Embarque      → hora salida display "DD/MM HH:mm"
 *   Libres        → butacas disponibles
 *   Calidad       → clase (CA, SE, CI…)
 *   Tarifa        → precio (puede ser -1 si no aplica)
 *   Desembarque   → hora llegada display "DD/MM HH:mm"
 *   FechaEmbarque → datetime ISO de salida
 *   Fec           → timestamp de la consulta
 *   TextoTarifas  → resumen tarifas "CA 400,000 / SU 500,000"
 *   TextoTarifasFull → tarifas con disponibilidad "CA 28 400,000 / SU 6 500,000"
 */
function mapSearch(rows, originId, destinationId) {
  // El DataSet devuelve ServiciosxDiaId (viajes) y ServiciosxDiaId1 (RG3450)
  // parseDataSet con tableTag='ServiciosxDiaId' ya filtra solo los viajes,
  // pero si se llamó sin tableTag filtramos los que tienen campo 'Id'
  return rows
    .filter((r) => r.Id !== undefined)
    .map((r) => {
      const tarifa = parseFloat(r.Tarifa);
      return {
        id: r.Id,
        provider: "delta",
        company: r.Emp || null,
        serviceCode: r.Cod || null,
        origin: {
          id: String(originId),
          name: null, // Delta no devuelve nombre en esta respuesta
        },
        destination: {
          id: String(destinationId),
          name: null,
        },
        departureDisplay: r.Embarque || null, // "13/04 18:45"
        arrivalDisplay: r.Desembarque || null, // "14/04 08:45"
        departureTime: r.FechaEmbarque || null, // ISO con timezone
        durationMinutes: null,
        serviceClass: mapCalidad(r.Calidad),
        serviceClassCode: r.Calidad || null,
        availableSeats: r.Libres ? parseInt(r.Libres) : 0,
        totalSeats: null,
        currency: "PYG",
        minFare: !isNaN(tarifa) && tarifa > 0 ? tarifa : null,
        faresText: r.TextoTarifas || null,
        faresTextFull: r.TextoTarifasFull || null,
        raw: r,
      };
    });
}

/**
 * ObtenerTaquilla → floors[] con seats[]
 *
 * Campos reales confirmados por PDF oficial:
 *   Piso    → STRING  piso del coche ("1", "2")
 *   Columna → INTEGER columna en el layout
 *   Fila    → INTEGER fila en el layout
 *   Color   → STRING  color de referencia visual
 *   Texto   → STRING  número/etiqueta de la butaca (ej: "01", "02")
 *   Estado  → STRING  estado de la butaca
 *
 * El ID único de butaca se construye como Piso+Fila+Columna ya que
 * Delta no devuelve un IdButaca explícito.
 */
function mapAvailability(rows, serviceId) {
  const byFloor = {};

  rows.forEach((r) => {
    const floor = parseInt(r.Piso || "1") || 1;
    if (!byFloor[floor]) byFloor[floor] = [];

    const fila = r.Fila ? parseInt(r.Fila) : null;
    const columna = r.Columna ? parseInt(r.Columna) : null;
    const texto = r.Texto ? r.Texto.trim() : null;

    byFloor[floor].push({
      id: `${floor}-${fila}-${columna}`, // ID sintético único
      number: texto, // número visible en pantalla
      status: mapSeatStatus(r.Estado),
      color: r.Color || null,
      row: fila,
      column: columna,
      raw: r,
    });
  });

  const floors = Object.entries(byFloor)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([floor, seats]) => ({ floor: parseInt(floor), seats }));

  if (!floors.length) floors.push({ floor: 1, seats: [] });

  return { serviceId: String(serviceId), floors };
}

/**
 * ObtenerTarifas → fares[]
 *
 * Campos reales confirmados por PDF oficial:
 *   Codigo      → STRING código de calidad (ej: "CA", "SE")
 *   Descripcion → STRING descripción (ej: "Cama", "Semicama")
 *   Tarifa      → MONEY  precio
 */
function mapFares(rows, serviceId) {
  const fares = rows.map((r) => ({
    id: r.Codigo || null,
    name: r.Descripcion || r.Codigo || "Tarifa estándar",
    code: r.Codigo || null,
    price: parseFloat(r.Tarifa || "0"),
    currency: "PYG",
    conditions: null,
    raw: r,
  }));

  return { serviceId: String(serviceId), fares };
}

/**
 * BloquearButacas → block result
 * Resultado: INTEGER (0 = OK)
 */
function mapBlock(rawValue, connectionId, seats) {
  return {
    connectionId: String(connectionId),
    providerResult: rawValue,
    success: rawValue === "0",
    blockedSeats: seats,
    expiresAt: null,
  };
}

/**
 * DesbloquearButacas → unblock result
 * Resultado: Error (INT, 0=OK), Descripcion (STRING)
 */
function mapUnblock(rawValue, connectionId) {
  return {
    connectionId: String(connectionId),
    released: rawValue === "0",
    providerResult: rawValue,
  };
}

/**
 * Venta3 → sell result
 * Resultado del PDF: Error (INT, 0=OK), Descripcion (STRING)
 */
function mapSell(rows) {
  if (!rows.length) return { success: false, error: "Sin respuesta de Delta" };
  const r = rows[0];
  const errVal = r.Error !== undefined ? r.Error : r._value || "-1";
  const ok = String(errVal) === "0";
  return {
    success: ok,
    error: ok ? null : r.Descripcion || `Error Delta: ${errVal}`,
    raw: r,
  };
}

/**
 * BoletosConsultar → ticket completo
 * Campos reales confirmados por PDF oficial
 */
function mapTicket(rows) {
  if (!rows.length) return null;
  const r = rows[0];
  return {
    ticketNumber: r.Pasaje || null,
    company: r.Empresa || null,
    status: r.Devuelto === "S" ? "cancelled" : "issued",
    isOpen: r.Abierto === "S",
    serviceCode: r.Servicio || null,
    passenger: {
      lastName: r.Apellido || null,
      name: r.Nombres || null,
      docType: r.DocTipo || null,
      docNumber: r.DocNumero || null,
      nationality: r.Nacionalidad || null,
      birthDate: r.FechaNacimiento || null,
      occupation: r.Ocupacion || null,
      gender: r.Sexo || null,
      isMinor: r.Menor === "S",
    },
    trip: {
      departureDate: r.FechaEmb || null,
      arrivalDate: r.FechaDes || null,
      departureStop: r.Embarque || null,
      arrivalStop: r.Desemb || null,
      departureFull: r.EmbarqueDes || null,
      arrivalFull: r.DesembDes || null,
      seat: r.Butaca ? parseInt(r.Butaca) : null,
      serviceClass: mapCalidad(r.Calidad),
      serviceClassCode: r.Calidad || null,
      serviceClassDesc: r.CalidadDes || null,
    },
    payment: {
      amount: parseFloat(r.Importe || "0"),
      discount: parseFloat(r.Descuento || "0"),
      fare: r.Tarifa || null,
      currency: "PYG",
      method: r.FormaPago || null,
      taxable: parseFloat(r.Gravado || "0"),
      iva: parseFloat(r.IVA || "0"),
      exempt: parseFloat(r.Exento || "0"),
      rg: {
        percent: parseFloat(r.RGPorcent || "0"),
        amount: r.RGImporte || null,
        description: r.RGDescripc || null,
        total: r.RGTotal || null,
      },
    },
    issuedAt: r.VentaFec || null,
    queryDate: r.FechaActual || null,
    newTicket: r.BoletoNuevo || null,
    raw: r,
  };
}

function mapCatalog(rows) {
  return rows;
}

// ─── Helpers de formato ────────────────────────────────────────────────────────

function mapSeatStatus(raw) {
  if (!raw) return "available";
  const val = String(raw).toLowerCase().trim();
  if (["l", "libre", "disponible", "0", "false", ""].includes(val))
    return "available";
  if (["o", "v", "ocupado", "vendido", "1", "true"].includes(val))
    return "occupied";
  if (["b", "r", "bloqueado", "reservado"].includes(val)) return "blocked";
  return "available";
}

/**
 * Formatea asientos para BloquearButacas.
 * Delta espera cadena de 3 dígitos por butaca, cero-pad izquierda.
 * Ej: [1, 2, 45] → "001002045"
 */
function formatButacasBlock(seats) {
  let arr;
  if (typeof seats === "string") {
    if (/^\d+$/.test(seats) && seats.length % 3 === 0) return seats;
    arr = seats
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (Array.isArray(seats)) {
    arr = seats.map((s) => String(s).trim()).filter(Boolean);
  } else {
    arr = [String(seats)];
  }
  return arr.map((n) => String(parseInt(n)).padStart(3, "0")).join("");
}

/**
 * Construye StringButacas para Venta3.
 * Formato por pasajero (PDF oficial):
 *   BBB(3) + CC(2) + T×15 + P×13 + D(1) + N×17
 *
 * ⚠️  Los largos T, P, N son estimados. Verificar con Venta3 real.
 *
 * @param {Array<{seat, qualityCode, amount, ticketNumber, docType, docNumber}>} passengers
 */
function buildStringButacas(passengers) {
  return passengers
    .map((p) => {
      const bbb = String(parseInt(p.seat || "0")).padStart(3, "0");
      const cc = String(p.qualityCode || "")
        .padEnd(2, " ")
        .slice(0, 2);
      const imp = Math.round(parseFloat(p.amount || 0) * 100);
      const ttt = String(imp).padStart(15, "0");
      const ppp = String(p.ticketNumber || "0").padStart(13, "0");
      const d = String(p.docType || "").slice(0, 1);
      const nnn = String(p.docNumber || "")
        .padStart(17, " ")
        .slice(-17);
      return `${bbb}${cc}${ttt}${ppp}${d}${nnn}`;
    })
    .join("");
}

module.exports = {
  parseDataSet,
  parseDataSetAll,
  parsePrimitive,
  mapSearch,
  mapAvailability,
  mapFares,
  mapBlock,
  mapUnblock,
  mapSell,
  mapTicket,
  mapCatalog,
  mapCalidad,
  mapSeatStatus,
  formatButacasBlock,
  buildStringButacas,
};
