/**
 * Delta Provider
 *
 * Expone todas las operaciones del GDS usando Delta como proveedor.
 * Recibe parámetros normalizados y devuelve datos en schema GDS.
 */

const client = require("./client");
const mapper = require("./mapper");
const { success, error } = require("../../normalizer");

const PROVIDER = "delta";

// ─── Catálogos ─────────────────────────────────────────────────────────────────

async function getStops() {
  try {
    const xml = await client.obtenerParadasHomologadas();
    const rows = mapper.parseDataSet(xml);
    return success(PROVIDER, "getStops", { stops: mapper.mapCatalog(rows) });
  } catch (err) {
    return error(PROVIDER, "getStops", err.message);
  }
}

async function getCountries() {
  try {
    const xml = await client.paisesGrilla();
    const rows = mapper.parseDataSet(xml);
    return success(PROVIDER, "getCountries", {
      countries: mapper.mapCatalog(rows),
    });
  } catch (err) {
    return error(PROVIDER, "getCountries", err.message);
  }
}

async function getDocTypes() {
  try {
    const xml = await client.tiposDocumentoGrilla();
    const rows = mapper.parseDataSet(xml);
    return success(PROVIDER, "getDocTypes", {
      docTypes: mapper.mapCatalog(rows),
    });
  } catch (err) {
    return error(PROVIDER, "getDocTypes", err.message);
  }
}

// ─── Búsqueda ──────────────────────────────────────────────────────────────────

/**
 * @param {{ originId, destinationId, date }} params
 * date en formato AAAA-MM-DD
 */
async function search({ originId, destinationId, date }) {
  try {
    const xml = await client.obtenerServicios({
      IdParadas_Origen: originId,
      IdParadas_Destino: destinationId,
      Fecha: date,
    });
    // El DataSet tiene dos tablas: ServiciosxDiaId (viajes) y ServiciosxDiaId1 (RG3450)
    // Tomamos solo la primera
    const rows = mapper.parseDataSet(xml, "ServiciosxDiaId");
    const trips = mapper.mapSearch(rows, originId, destinationId);
    return success(PROVIDER, "search", { trips });
  } catch (err) {
    return error(PROVIDER, "search", err.message);
  }
}

// ─── Disponibilidad y tarifas ──────────────────────────────────────────────────

/**
 * @param {{ serviceId, originId, destinationId }} params
 */
async function availability({ serviceId, originId, destinationId }) {
  try {
    const xml = await client.obtenerTaquilla({
      IdServicios: serviceId,
      IdParadas_Origen: originId,
      IdParadas_Destino: destinationId,
    });
    const rows = mapper.parseDataSet(xml);
    const data = mapper.mapAvailability(rows, serviceId);
    return success(PROVIDER, "availability", data);
  } catch (err) {
    return error(PROVIDER, "availability", err.message);
  }
}

/**
 * @param {{ serviceId, originId, destinationId }} params
 */
async function fares({ serviceId, originId, destinationId }) {
  try {
    const xml = await client.obtenerTarifas({
      IdServicios: serviceId,
      IdParadas_Origen: originId,
      IdParadas_Destino: destinationId,
    });
    const rows = mapper.parseDataSet(xml);
    const data = mapper.mapFares(rows, serviceId);
    return success(PROVIDER, "fares", data);
  } catch (err) {
    return error(PROVIDER, "fares", err.message);
  }
}

// ─── Bloqueo ───────────────────────────────────────────────────────────────────

/**
 * Genera un NroConexion único (entre 1.000.000 y 9.999.999)
 */
async function generateConnectionId() {
  try {
    const xml = await client.generadorNroConexion();
    const connectionId = String(mapper.parsePrimitive(xml));
    return success(PROVIDER, "generateConnection", { connectionId });
  } catch (err) {
    return error(PROVIDER, "generateConnection", err.message);
  }
}

/**
 * Bloquea butacas temporalmente.
 *
 * @param {{ serviceId, originId, destinationId, seats, connectionId? }} params
 * seats: array [1,2,45] o string "1,2,45" — se formatea automáticamente a "001002045"
 */
async function block({
  serviceId,
  originId,
  destinationId,
  seats,
  connectionId,
}) {
  try {
    // Si no viene connectionId, generamos uno internamente (solo el número crudo)
    let nroConexion = connectionId;
    if (!nroConexion) {
      const xml = await client.generadorNroConexion();
      nroConexion = String(mapper.parsePrimitive(xml));
    }
    if (!nroConexion)
      throw new Error("No se pudo generar NroConexion en Delta");

    // Formato requerido por Delta: 3 dígitos por butaca, cero-pad izq.
    // Ej: [1, 2, 45] → "001002045"
    const butacasFormateadas = mapper.formatButacasBlock(seats);

    const xml = await client.bloquearButacas({
      IdServicios: serviceId,
      IdParadas_Origen: originId,
      IdParadas_Destino: destinationId,
      NroConexion: nroConexion,
      Butacas: butacasFormateadas,
    });

    const rawValue = mapper.parsePrimitive(xml);
    const data = mapper.mapBlock(rawValue, nroConexion, butacasFormateadas);
    return success(PROVIDER, "block", data);
  } catch (err) {
    return error(PROVIDER, "block", err.message);
  }
}

/**
 * @param {{ connectionId }} params
 */
async function unblock({ connectionId }) {
  try {
    const xml = await client.desbloquearButacas({
      NroConexion: String(connectionId),
    });
    const rawValue = mapper.parsePrimitive(xml);
    const data = mapper.mapUnblock(rawValue, connectionId);
    return success(PROVIDER, "unblock", data);
  } catch (err) {
    return error(PROVIDER, "unblock", err.message);
  }
}

// ─── Pasajeros ─────────────────────────────────────────────────────────────────

/**
 * @param {object} passenger
 * @param {string} passenger.docType        - TipoDocumento (1 char, de TiposDocumentoGrilla)
 * @param {string} passenger.docNumber      - NroDocumento (máx 15 chars)
 * @param {string} passenger.lastName       - Apellido (máx 20 chars)
 * @param {string} passenger.name           - Nombre (máx 30 chars)
 * @param {string} [passenger.occupation]   - Ocupacion (máx 15 chars)
 * @param {string} [passenger.birthDate]    - FechaNacimiento (AAAA-MM-DD)
 * @param {string} [passenger.gender]       - Sexo (1 char: M/F)
 * @param {string} [passenger.nationality]  - Nacionalidad (2 chars, de PaisesGrilla)
 * @param {string} [passenger.country]      - PaisResidencia (2 chars, de PaisesGrilla)
 * @param {string} [passenger.phone]        - Telefono (máx 20 chars)
 */
async function createPassenger(passenger) {
  try {
    const xml = await client.pasajerosAlta({
      TipoDocumento: passenger.docType,
      NroDocumento: passenger.docNumber,
      Apellido: passenger.lastName,
      Nombre: passenger.name,
      Ocupacion: passenger.occupation || "",
      FechaNacimiento: passenger.birthDate || "",
      Sexo: passenger.gender || "",
      Nacionalidad: passenger.nationality || "",
      PaisResidencia: passenger.country || "",
      Telefono: passenger.phone || "",
    });
    const rows = mapper.parseDataSet(xml);
    // Respuesta: Error (0=OK), Descripcion
    const r = rows[0] || {};
    const ok = String(r.Error) === "0";
    return success(PROVIDER, "createPassenger", {
      success: ok,
      error: ok ? null : r.Descripcion || "Error al crear pasajero",
      raw: r,
    });
  } catch (err) {
    return error(PROVIDER, "createPassenger", err.message);
  }
}

async function findPassenger({ docType, docNumber }) {
  try {
    const xml = await client.pasajerosConsulta({
      TipoDocumento: docType,
      NroDocumento: docNumber,
    });
    const rows = mapper.parseDataSet(xml);
    return success(PROVIDER, "findPassenger", { passenger: rows[0] || null });
  } catch (err) {
    return error(PROVIDER, "findPassenger", err.message);
  }
}

// ─── Venta ─────────────────────────────────────────────────────────────────────

/**
 * Emite el/los boleto(s) — Venta3.
 *
 * StringButacas: formato especial por pasajero (ver mapper.buildStringButacas)
 * Si `seats` es un array de objetos detallados, se construye automáticamente.
 * Si `seats` es un string preformateado, se usa directamente.
 *
 * @param {object} params
 * @param {number|string}   params.serviceId
 * @param {number|string}   params.connectionId   - NroConexion de block()
 * @param {number|string}   params.originId
 * @param {number|string}   params.destinationId
 * @param {number}          params.ticketCount    - CantBoletos
 * @param {number|string}   params.totalAmount    - ImporteTotal (con punto decimal)
 * @param {string|Array}    params.seats
 *   Si string preformateado: se envía tal cual
 *   Si Array de objetos: [{ seat, qualityCode, amount, ticketNumber, docType, docNumber }]
 */
/**
 * @param {object} params
 * @param {string}        params.company         - Código de empresa (EmpresaBoleto, ej: "SOL")
 * @param {number|string} params.serviceId
 * @param {number|string} params.connectionId    - NroConexion de block()
 * @param {number|string} params.originId
 * @param {number|string} params.destinationId
 * @param {number}        params.ticketCount     - CantBoletos
 * @param {number|string} params.totalAmount     - ImporteTotal (con punto decimal)
 * @param {string|Array}  params.seats
 *   Si string preformateado: se envía tal cual
 *   Si Array de objetos: [{ seat, qualityCode, amount, ticketNumber?, docType, docNumber }]
 *   Si ticketNumber no viene en cada seat, se obtiene automáticamente de BoletosProximoNumeroLibre
 */
async function sell({
  company,
  serviceId,
  connectionId,
  originId,
  destinationId,
  ticketCount,
  totalAmount,
  seats,
}) {
  try {
    let processedSeats = seats;
    let assignedTicketNumbers = [];

    // Si seats es un array de objetos, asignar número de boleto a los que no lo tienen
    if (Array.isArray(seats)) {
      processedSeats = await Promise.all(
        seats.map(async (seat) => {
          if (!seat.ticketNumber) {
            const ticketXml = await client.boletosProximoNumeroLibre({
              EmpresaBoleto: company,
            });
            const ticketNumber = String(
              mapper.parsePrimitive(ticketXml),
            ).trim();
            if (!ticketNumber || ticketNumber === "null") {
              throw new Error(
                `No se pudo obtener número de boleto para butaca ${seat.seat}`,
              );
            }
            return { ...seat, ticketNumber };
          }
          return seat;
        }),
      );
      assignedTicketNumbers = processedSeats.map((s) => s.ticketNumber);
    }

    const stringButacas =
      typeof processedSeats === "string"
        ? processedSeats
        : mapper.buildStringButacas(processedSeats);

    const xml = await client.venta3({
      IdServicios: serviceId,
      NroConexion: connectionId,
      IdParadas_Origen: originId,
      IdParadas_Destino: destinationId,
      CantBoletos: ticketCount,
      ImporteTotal: String(totalAmount),
      StringButacas: stringButacas,
    });

    const rows = mapper.parseDataSet(xml);
    const result = mapper.mapSell(rows);

    return success(PROVIDER, "sell", {
      ...result,
      ticketNumbers: assignedTicketNumbers,
      company,
    });
  } catch (err) {
    // Si el error viene de TablaError de Delta, incluir código y descripción estructurados
    if (err.code) {
      return {
        provider: PROVIDER,
        operation: "sell",
        status: "error",
        error: {
          message: err.message,
          errorCode: err.code,
          description: err.description || null,
        },
      };
    }
    return error(PROVIDER, "sell", err.message);
  }
}

// ─── Consulta de boleto ────────────────────────────────────────────────────────

/**
 * @param {{ company, ticketNumber }} params
 * company: código de empresa (ej: "SOL", "EPA")
 */
async function queryTicket({ company, ticketNumber }) {
  try {
    const xml = await client.boletosConsultar({
      Empresa: company,
      Boleto: ticketNumber,
    });
    const rows = mapper.parseDataSet(xml);
    const ticket = mapper.mapTicket(rows);
    return success(PROVIDER, "queryTicket", { ticket });
  } catch (err) {
    return error(PROVIDER, "queryTicket", err.message);
  }
}

async function queryTicketQR({ company, ticketNumber }) {
  try {
    const xml = await client.boletosConsultarQR({
      Empresa: company,
      Boleto: ticketNumber,
    });
    const rows = mapper.parseDataSet(xml);
    // Resultado: CDC (STRING), QR (STRING)
    const r = rows[0] || {};
    return success(PROVIDER, "queryTicketQR", {
      cdc: r.CDC || null,
      qr: r.QR || null,
    });
  } catch (err) {
    return error(PROVIDER, "queryTicketQR", err.message);
  }
}

// ─── Recorrido del servicio ────────────────────────────────────────────────────

async function getServiceRoute({ serviceId }) {
  try {
    const xml = await client.serviciosRecorrido({ IdServicios: serviceId });
    const rows = mapper.parseDataSet(xml);
    // Resultado: Id, Orden, Codigo, Horario, Parada
    return success(PROVIDER, "getServiceRoute", {
      stops: mapper.mapCatalog(rows),
    });
  } catch (err) {
    return error(PROVIDER, "getServiceRoute", err.message);
  }
}

// ─── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  getStops,
  getCountries,
  getDocTypes,
  search,
  availability,
  fares,
  block,
  unblock,
  generateConnectionId,
  createPassenger,
  findPassenger,
  sell,
  queryTicket,
  queryTicketQR,
  getServiceRoute,
};
