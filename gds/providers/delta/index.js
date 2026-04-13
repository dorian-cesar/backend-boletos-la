/**
 * Delta Provider
 *
 * Expone todas las operaciones del GDS implementadas con Delta como proveedor.
 * Cada método recibe parámetros normalizados y devuelve datos en schema GDS.
 *
 * Operaciones:
 *  search        - Buscar viajes disponibles
 *  availability  - Mapa de butacas
 *  fares         - Tarifas del tramo
 *  block         - Bloquear butacas
 *  unblock       - Liberar bloqueo
 *  sell          - Emitir boleto (Venta3)
 *  queryTicket   - Consultar boleto por número
 *  getStops      - Catálogo de paradas
 *  getCountries  - Catálogo de países
 *  getDocTypes   - Tipos de documento
 *  createPassenger - Alta de pasajero
 *  findPassenger   - Consulta de pasajero
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
 * @param {object} params
 * @param {number|string} params.originId     - IdParadas_Origen
 * @param {number|string} params.destinationId - IdParadas_Destino
 * @param {string}        params.date          - Fecha en formato 'YYYY-MM-DD' o 'DD/MM/YYYY'
 */
async function search({ originId, destinationId, date }) {
  try {
    const xml = await client.obtenerServicios({
      IdParadas_Origen: originId,
      IdParadas_Destino: destinationId,
      Fecha: date,
    });
    const rows = mapper.parseDataSet(xml, "ServiciosxDiaId");
    const trips = mapper.mapSearch(rows, originId, destinationId);
    return success(PROVIDER, "search", { trips });
  } catch (err) {
    return error(PROVIDER, "search", err.message);
  }
}

// ─── Disponibilidad y tarifas ──────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {number|string} params.serviceId
 * @param {number|string} params.originId
 * @param {number|string} params.destinationId
 */
async function availability({ serviceId, originId, destinationId }) {
  try {
    const xml = await client.obtenerTaquilla({
      IdServicios: serviceId,
      IdParadas_Origen: originId,
      IdParadas_Destino: destinationId,
    });
    const tables = mapper.parseDataSetAll(xml);
    const keys = Object.keys(tables);
    const seatsRows = tables[keys[0]] || [];
    const metaRows = tables[keys[1]] || [];
    const data = mapper.mapAvailability(seatsRows, metaRows, serviceId);
    return success(PROVIDER, "availability", data);
  } catch (err) {
    return error(PROVIDER, "availability", err.message);
  }
}

/**
 * @param {object} params
 * @param {number|string} params.serviceId
 * @param {number|string} params.originId
 * @param {number|string} params.destinationId
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
 * Genera un número de conexión único en Delta (equivale a una sesión de compra)
 */
async function generateConnectionId() {
  const xml = await client.generadorNroConexion();
  const val = mapper.parsePrimitive(xml);
  return val;
}

/**
 * @param {object} params
 * @param {number|string} params.serviceId
 * @param {number|string} params.originId
 * @param {number|string} params.destinationId
 * @param {string}        params.seats   - Ej: "1,2,3" o "1-2-3" (formato que acepta Delta)
 * @param {string}        [params.connectionId] - Si ya tenés uno generado
 */
async function block({
  serviceId,
  originId,
  destinationId,
  seats,
  connectionId,
}) {
  try {
    // Si no viene connectionId, generamos uno nuevo
    const nroConexion = connectionId || (await generateConnectionId());
    if (!nroConexion)
      throw new Error("No se pudo generar NroConexion en Delta");

    const xml = await client.bloquearButacas({
      IdServicios: serviceId,
      IdParadas_Origen: originId,
      IdParadas_Destino: destinationId,
      NroConexion: nroConexion,
      Butacas: seats,
    });

    const rawValue = mapper.parsePrimitive(xml);
    const data = mapper.mapBlock(rawValue, nroConexion, seats);
    return success(PROVIDER, "block", data);
  } catch (err) {
    return error(PROVIDER, "block", err.message);
  }
}

/**
 * @param {object} params
 * @param {string|number} params.connectionId
 */
async function unblock({ connectionId }) {
  try {
    const xml = await client.desbloquearButacas({ NroConexion: connectionId });
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
 * @param {string} passenger.docType        - TipoDocumento
 * @param {string} passenger.docNumber      - NroDocumento
 * @param {string} passenger.lastName       - Apellido
 * @param {string} passenger.name           - Nombre
 * @param {string} [passenger.occupation]   - Ocupacion
 * @param {string} [passenger.birthDate]    - FechaNacimiento
 * @param {string} [passenger.gender]       - Sexo
 * @param {string} [passenger.nationality]  - Nacionalidad
 * @param {string} [passenger.country]      - PaisResidencia
 * @param {string} [passenger.phone]        - Telefono
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
    return success(PROVIDER, "createPassenger", {
      passenger: mapper.mapCatalog(rows)[0] || {},
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
    return success(PROVIDER, "findPassenger", {
      passenger: mapper.mapCatalog(rows)[0] || null,
    });
  } catch (err) {
    return error(PROVIDER, "findPassenger", err.message);
  }
}

// ─── Venta ─────────────────────────────────────────────────────────────────────

/**
 * Construye el StringButacas para Venta3.
 * Formato por asiento (51 chars): BBBCCTTTTTTTTTTTTTTTPPPPPPPPPPPPPPPDNNNNNNNNNNNNNNN
 * BBB: Butaca (3)
 * CC: Calidad (2)
 * TTT...: Precio * 100 (15)
 * PPP...: Nro Pasaje (15)
 * D: Tipo Documento (1)
 * NNN...: Nro Documento (15)
 */
function buildStringButacas(seats) {
  if (typeof seats === "string") return seats;
  if (!Array.isArray(seats)) return "";

  return seats.map(s => {
    const BBB = String(s.seat || s.number || "0").padStart(3, "0").slice(-3);
    const CC = String(s.quality || s.type || "CA").padEnd(2, " ").slice(0, 2);
    
    // precio * 100
    const priceVal = Math.round(parseFloat(s.price || 0) * 100);
    const TTT = String(priceVal).padStart(15, "0").slice(-15);
    
    const PPP = String(s.ticket || s.pasaje || "0").padStart(15, "0").slice(-15);
    const D = String(s.docType || "1").charAt(0) || "1";
    const NNN = String(s.docNumber || "0").padStart(15, "0").slice(-15);

    return BBB + CC + TTT + PPP + D + NNN;
  }).join("");
}

/**
 * Emite el boleto (Venta3).
 *
 * @param {object} params
 * @param {number|string} params.serviceId
 * @param {number|string} params.connectionId  - NroConexion generado en block()
 * @param {number|string} params.originId
 * @param {number|string} params.destinationId
 * @param {number}        params.ticketCount   - CantBoletos
 * @param {string|number} params.totalAmount   - ImporteTotal
 * @param {string|array}  params.seats         - Array de objetos de asientos o String preformateado
 */
async function sell({
  serviceId,
  connectionId,
  originId,
  destinationId,
  ticketCount,
  totalAmount,
  seats,
}) {
  try {
    const formattedSeats = buildStringButacas(seats);
    
    const xml = await client.venta3({
      IdServicios: serviceId,
      NroConexion: connectionId,
      IdParadas_Origen: originId,
      IdParadas_Destino: destinationId,
      CantBoletos: ticketCount,
      ImporteTotal: String(totalAmount),
      StringButacas: formattedSeats,
    });
    const rows = mapper.parseDataSet(xml);
    const tickets = mapper.mapSell(rows);
    return success(PROVIDER, "sell", { tickets });
  } catch (err) {
    return error(PROVIDER, "sell", err.message);
  }
}

// ─── Consulta de boleto ────────────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {string} params.company    - Empresa
 * @param {string} params.ticketNumber - Boleto
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
    return success(PROVIDER, "queryTicketQR", {
      data: mapper.mapCatalog(rows),
    });
  } catch (err) {
    return error(PROVIDER, "queryTicketQR", err.message);
  }
}

async function generateConnection() {
  try {
    const connectionId = await generateConnectionId();
    return success(PROVIDER, "generateConnection", { connectionId });
  } catch (err) {
    return error(PROVIDER, "generateConnection", err.message);
  }
}

// ─── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  // Catálogos
  getStops,
  getCountries,
  getDocTypes,
  // Búsqueda
  search,
  // Disponibilidad
  availability,
  fares,
  // Bloqueo
  generateConnection,
  block,
  unblock,
  // Pasajeros
  createPassenger,
  findPassenger,
  // Venta
  sell,
  // Consulta
  queryTicket,
  queryTicketQR,
};
