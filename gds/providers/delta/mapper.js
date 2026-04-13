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
 */
function mapAvailability(seatsRows, metaRows, serviceId) {
  const byFloor = {};

  // Extraer información general (tarifas) de la segunda tabla
  let tarifa = null;
  if (metaRows && metaRows.length > 0) {
    // Tomamos TarifaA o similar si la segunda tabla la provee
    const meta = metaRows[0];
    tarifa = parseFloat(meta.TarifaA || meta.Tarifa || "0");
  }

  seatsRows.forEach((r) => {
    const floor = parseInt(r.Piso || r.NroPiso || r.NumPiso || "1") || 1;
    if (!byFloor[floor]) byFloor[floor] = [];

    // Propiedades crudas esparcidas según solicitado
    const seatObj = {
      ...r,
      id: r.IdButaca || r.NroButaca || r.Butaca || null,
      number:
        (r.Texto && r.Texto.trim()) ||
        r.NroButaca ||
        r.Butaca ||
        r.NumeroButaca ||
        null,
      status: mapSeatStatus(r.Estado || r.EstadoButaca || r.Disponible),
      type: r.TipoButaca || r.Tipo || r.Calidad || "standard",
      row: r.Fila ? parseInt(r.Fila) : null,
      column: r.Columna ? parseInt(r.Columna) : null,
      price: tarifa > 0 ? tarifa : null,
      raw: r,
    };

    byFloor[floor].push(seatObj);
  });

  const floors = Object.entries(byFloor).map(([floor, seats]) => ({
    floor: parseInt(floor),
    seats,
  }));

  if (!floors.length) floors.push({ floor: 1, seats: [] });

  return { serviceId: String(serviceId), floors };
}

/**
 * ObtenerTarifas → fares[]
 */
function mapFares(rows, serviceId) {
  const fares = rows.map((r) => ({
    id: r.IdTarifa || r.CodTarifa || null,
    name:
      r.NombreTarifa ||
      r.Descripcion ||
      r.Tipo ||
      r.Calidad ||
      "Tarifa estándar",
    price: parseFloat(r.Precio || r.Importe || r.Tarifa || "0"),
    currency: "PYG",
    conditions: r.Condiciones || null,
    raw: r,
  }));

  return { serviceId: String(serviceId), fares };
}

/**
 * BloquearButacas → block result
 */
function mapBlock(rawValue, connectionId, seats) {
  return {
    connectionId: String(connectionId),
    providerResult: rawValue,
    blockedSeats:
      typeof seats === "string"
        ? seats.split(",").map((s) => s.trim())
        : seats || [],
    expiresAt: null,
  };
}

/**
 * DesbloquearButacas → unblock result
 */
function mapUnblock(rawValue, connectionId) {
  return {
    connectionId: String(connectionId),
    released: rawValue !== "0" && rawValue !== "-1",
  };
}

/**
 * Venta3 → tickets[]
 */
function mapSell(rows) {
  return rows.map((r) => ({
    ticketNumber: r.NroBoleto || r.NroPasaje || r.Boleto || null,
    passenger: {
      name: r.Nombre || null,
      lastName: r.Apellido || null,
      docType: r.TipoDocumento || null,
      docNumber: r.NroDocumento || null,
    },
    seat: r.Butaca || r.NroButaca || null,
    origin: {
      id: r.IdParadas_Origen || null,
      name: r.Origen || r.ParadaOrigen || null,
    },
    destination: {
      id: r.IdParadas_Destino || null,
      name: r.Destino || r.ParadaDestino || null,
    },
    departureTime: r.FechaEmbarque || r.Fecha || r.FechaSalida || null,
    totalAmount: parseFloat(
      r.Importe || r.ImporteTotal || r.Precio || r.Tarifa || "0",
    ),
    currency: "PYG",
    issuedAt: new Date().toISOString(),
    raw: r,
  }));
}

/**
 * BoletosConsultar → ticket
 */
function mapTicket(rows) {
  if (!rows.length) return null;
  const r = rows[0];
  return {
    ticketNumber: r.NroBoleto || r.Boleto || null,
    status: r.Estado || r.EstadoBoleto || "unknown",
    passenger: {
      name: r.Nombre || null,
      lastName: r.Apellido || null,
      docType: r.TipoDocumento || null,
      docNumber: r.NroDocumento || null,
    },
    trip: {
      origin: r.Origen || r.ParadaOrigen || null,
      destination: r.Destino || r.ParadaDestino || null,
      departureTime: r.FechaEmbarque || r.Fecha || null,
      seat: r.Butaca || r.NroButaca || null,
    },
    totalAmount: parseFloat(r.Importe || r.ImporteTotal || "0"),
    currency: "PYG",
    raw: r,
  };
}

/**
 * Catálogos genéricos (stops, países, doc types)
 */
function mapCatalog(rows) {
  return rows;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapSeatStatus(raw) {
  if (!raw) return "available";
  const val = String(raw).toLowerCase().trim();
  if (["libre", "disponible", "l", "0", "false"].includes(val))
    return "available";
  if (["ocupado", "vendido", "o", "1", "true", "v"].includes(val))
    return "occupied";
  if (["bloqueado", "reservado", "b", "r"].includes(val)) return "blocked";
  return "available";
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
  // Util expuesto para debug
  mapCalidad,
  mapSeatStatus,
};
