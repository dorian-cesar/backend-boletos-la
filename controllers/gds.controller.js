/**
 * GDS Controller
 *
 * Recibe los requests HTTP, valida parámetros básicos y delega al GDS.
 * Nunca contiene lógica de negocio de ningún proveedor específico.
 *
 * La respuesta siempre sigue el schema normalizado del GDS:
 * { provider, operation, status, data|error, meta }
 */

const gds = require("../gds/index");

// Helper: extrae provider de params o query, default 'delta'
function getProvider(req) {
  return (req.params.provider || req.query.provider || "delta").toLowerCase();
}

// Helper: extrae canal de los headers (ej. X-Channel), query o body, default 'web'
function getChannel(req) {
  return (
    req.headers["x-channel"] ||
    req.query.channel ||
    (req.body && req.body.channel) ||
    "web"
  );
}

// Helper: responde con el resultado del GDS (ya viene normalizado)
function send(res, result) {
  const httpStatus = result.status === "success" ? 200 : 400;
  return res.status(httpStatus).json(result);
}

// ─── Info ──────────────────────────────────────────────────────────────────────

exports.listProviders = (req, res) => {
  res.json({ providers: gds.listProviders() });
};

// ─── Catálogos ─────────────────────────────────────────────────────────────────

exports.getStops = async (req, res) => {
  const provider = getProvider(req);
  const channel = getChannel(req);
  const result = await gds.getStops(provider, { channel });
  send(res, result);
};

exports.getAvailableDestinations = async (req, res) => {
  const provider = getProvider(req);
  const { originId, date } = req.query;

  if (!originId || !date) {
    return res.status(400).json({
      provider,
      operation: "getAvailableDestinations",
      status: "error",
      error: { message: "Faltan parámetros: originId, date" },
    });
  }

  try {
    const fs = require('fs');
    const path = require('path');
    const cachePath = path.join(__dirname, '..', 'data', 'gds_cache.json');
    
    if (!fs.existsSync(cachePath)) {
      return send(res, {
        provider,
        operation: "getAvailableDestinations",
        status: "success",
        data: { destinations: [] },
        meta: { warning: "Caché no generada aún" }
      });
    }

    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    
    let destinations = [];
    if (cache[originId] && cache[originId][date]) {
      destinations = cache[originId][date];
    }

    return send(res, {
      provider,
      operation: "getAvailableDestinations",
      status: "success",
      data: { destinations },
      meta: { source: "cache" }
    });

  } catch (err) {
    return send(res, {
      provider,
      operation: "getAvailableDestinations",
      status: "error",
      error: { message: err.message }
    });
  }
};

exports.getCountries = async (req, res) => {
  const provider = getProvider(req);
  const channel = getChannel(req);
  const result = await gds.getCountries(provider, { channel });
  send(res, result);
};

exports.getDocTypes = async (req, res) => {
  const provider = getProvider(req);
  const channel = getChannel(req);
  const result = await gds.getDocTypes(provider, { channel });
  send(res, result);
};

// ─── Búsqueda ──────────────────────────────────────────────────────────────────

/**
 * GET /api/gds/:provider/search
 * Query: originId, destinationId, date
 */
exports.search = async (req, res) => {
  const provider = getProvider(req);
  const channel = getChannel(req);
  const { originId, destinationId, date } = req.query;

  if (!originId || !destinationId || !date) {
    return res.status(400).json({
      provider,
      operation: "search",
      status: "error",
      error: { message: "Faltan parámetros: originId, destinationId, date" },
    });
  }

  const result = await gds.search(provider, { originId, destinationId, date, channel });

  // Filtrar los servicios pasados o que salen en menos de 2 horas (basado en UTC)
  if (result && result.status === "success" && result.data && Array.isArray(result.data.trips)) {
    const minDepartureTimeMs = Date.now() + 2 * 60 * 60 * 1000;
    result.data.trips = result.data.trips.filter((trip) => {
      if (!trip.departureTime) return true;
      const departureMs = new Date(trip.departureTime).getTime();
      return isNaN(departureMs) ? true : departureMs > minDepartureTimeMs;
    });
  }

  send(res, result);
};

// ─── Disponibilidad ────────────────────────────────────────────────────────────

/**
 * GET /api/gds/:provider/availability
 * Query: serviceId, originId, destinationId
 */
exports.availability = async (req, res) => {
  const provider = getProvider(req);
  const channel = getChannel(req);
  const { serviceId, originId, destinationId } = req.query;

  if (!serviceId || !originId || !destinationId) {
    return res.status(400).json({
      provider,
      operation: "availability",
      status: "error",
      error: {
        message: "Faltan parámetros: serviceId, originId, destinationId",
      },
    });
  }

  const result = await gds.availability(provider, {
    serviceId,
    originId,
    destinationId,
    channel,
  });
  send(res, result);
};

/**
 * GET /api/gds/:provider/fares
 * Query: serviceId, originId, destinationId
 */
exports.fares = async (req, res) => {
  const provider = getProvider(req);
  const channel = getChannel(req);
  const { serviceId, originId, destinationId } = req.query;

  if (!serviceId || !originId || !destinationId) {
    return res.status(400).json({
      provider,
      operation: "fares",
      status: "error",
      error: {
        message: "Faltan parámetros: serviceId, originId, destinationId",
      },
    });
  }

  const result = await gds.fares(provider, {
    serviceId,
    originId,
    destinationId,
    channel,
  });
  send(res, result);
};

// ─── Bloqueo ───────────────────────────────────────────────────────────────────

/**
 * GET | POST /api/gds/:provider/connection
 * Genera el identificador único de carrito o proceso de emisión
 */
exports.generateConnection = async (req, res) => {
  const provider = getProvider(req);
  const result = await gds.generateConnection(provider);
  send(res, result);
};

/**
 * POST /api/gds/:provider/block
 * Body: { serviceId, originId, destinationId, seats, connectionId? }
 */
exports.block = async (req, res) => {
  const provider = getProvider(req);
  const channel = getChannel(req);
  const { serviceId, originId, destinationId, seats, connectionId } =
    req.body || {};

  if (!serviceId || !originId || !destinationId || !seats) {
    return res.status(400).json({
      provider,
      operation: "block",
      status: "error",
      error: {
        message: "Faltan parámetros: serviceId, originId, destinationId, seats",
      },
    });
  }

  console.log(`[GDS:BLOCK] serviceId: ${serviceId}, seats: ${seats}, channel: ${channel}`);
  const result = await gds.block(provider, {
    serviceId,
    originId,
    destinationId,
    seats,
    connectionId,
    channel,
  });
  console.log(`[GDS:BLOCK] status: ${result.status}`);
  send(res, result);
};

/**
 * POST /api/gds/:provider/unblock
 * Body: { connectionId }
 */
exports.unblock = async (req, res) => {
  const provider = getProvider(req);
  const { connectionId } = req.body || {};

  if (!connectionId) {
    return res.status(400).json({
      provider,
      operation: "unblock",
      status: "error",
      error: { message: "Falta parámetro: connectionId" },
    });
  }

  console.log(`[GDS:UNBLOCK] connectionId: ${connectionId}`);
  const result = await gds.unblock(provider, { connectionId });
  console.log(`[GDS:UNBLOCK] status: ${result.status}`);
  send(res, result);
};

// ─── Pasajeros ─────────────────────────────────────────────────────────────────

/**
 * POST /api/gds/:provider/passengers
 * Body: { docType, docNumber, name, lastName, phone, occupation, birthDate, gender, nationality, country }
 */
exports.createPassenger = async (req, res) => {
  const provider = getProvider(req);
  const channel = getChannel(req);
  const {
    docType,
    docNumber,
    name,
    lastName,
    phone,
    occupation,
    birthDate,
    gender,
    nationality,
    country,
  } = req.body || {};

  if (
    !docType ||
    !docNumber ||
    !name ||
    !lastName ||
    !phone ||
    !occupation ||
    !birthDate ||
    !gender ||
    !nationality ||
    !country
  ) {
    return res.status(400).json({
      provider,
      operation: "createPassenger",
      status: "error",
      error: {
        message:
          "Faltan parámetros: docType, docNumber, name, lastName, phone, occupation, birthDate, gender, nationality, country",
      },
    });
  }

  console.log(`[GDS:CREATE_PASSENGER] name: ${name} ${lastName}, doc: ${docNumber}`);
  const result = await gds.createPassenger(provider, { ...req.body, channel });
  console.log(`[GDS:CREATE_PASSENGER] status: ${result.status}`);
  send(res, result);
};

/**
 * POST /api/gds/:provider/findPassenger
 * Body: { docType, docNumber }
 */
exports.findPassenger = async (req, res) => {
  const provider = getProvider(req);
  const { docType, docNumber } = req.body || {};

  if (!docType || !docNumber) {
    return res.status(400).json({
      provider,
      operation: "findPassenger",
      status: "error",
      error: { message: "Faltan parámetros: docType, docNumber" },
    });
  }

  const result = await gds.findPassenger(provider, { docType, docNumber });
  send(res, result);
};

// ─── Venta ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/gds/:provider/sell
 * Body: { company, serviceId, connectionId, originId, destinationId, ticketCount, totalAmount, seats }
 */
exports.sell = async (req, res) => {
  const provider = getProvider(req);
  const channel = getChannel(req);
  const {
    company,
    serviceId,
    connectionId,
    originId,
    destinationId,
    ticketCount,
    totalAmount,
    seats,
    authorization_number,
  } = req.body || {};

  if (
    !company ||
    !serviceId ||
    !connectionId ||
    !originId ||
    !destinationId ||
    !ticketCount ||
    !totalAmount ||
    !seats ||
    !authorization_number
  ) {
    return res.status(400).json({
      provider,
      operation: "sell",
      status: "error",
      error: {
        message:
          "Faltan parámetros: company, serviceId, connectionId, originId, destinationId, ticketCount, totalAmount, seats, authorization_number",
      },
    });
  }

  // VALIDACIÓN CON BANCARD ANTES DEL SELL
  try {
    const bancardUrl = process.env.BACKEND_BANCARD || "https://wit-bancard.dev-wit.com";
    
    const payloadBancard = {
      action: "validate-payment",
      amount: totalAmount,
      authorizationNumber: authorization_number,
    };
    
    console.log("[GDS:SELL] Iniciando validación con Bancard...");
    console.log(`[GDS:SELL] Payload a enviar:`, JSON.stringify(payloadBancard));

    const bancardRes = await fetch(`${bancardUrl}/api/pagosimple`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadBancard),
    });

    const bancardData = await bancardRes.json();
    console.log(`[GDS:SELL] Respuesta de Bancard (Status HTTP ${bancardRes.status}):`, JSON.stringify(bancardData));

    if (!bancardRes.ok || bancardData.status !== "success") {
      console.log("[GDS:SELL] Validación con Bancard fallida. Cancelando emisión en Delta.");
      return res.status(bancardRes.status !== 200 ? bancardRes.status : 400).json({
        provider,
        operation: "sell",
        status: "error",
        error: {
          message: bancardData.message || "Error validando pago con Bancard",
          details: bancardData.errors || null,
        },
      });
    }

    console.log(`[GDS:SELL] Validación de pago exitosa (invoice: ${bancardData.data?.invoiceNumber})`);
  } catch (error) {
    console.error("[GDS:SELL] Error conectando con backend Bancard:", error);
    return res.status(500).json({
      provider,
      operation: "sell",
      status: "error",
      error: {
        message: "Error de conexión al validar pago con Bancard",
      },
    });
  }

  console.log(`[GDS:SELL] serviceId: ${serviceId}, seats: ${seats}, channel: ${channel}`);

  let result;
  let attempts = 0;
  const maxRetries = 3;

  while (attempts <= maxRetries) {
    result = await gds.sell(provider, { ...req.body, channel });
    console.log(`[GDS:SELL] Attempt ${attempts + 1}, status: ${result.status}`);

    if (result.status === "success") break;

    // Si el error tiene errorCode "0", lo consideramos exitoso y paramos
    const errorCode = result.error?.errorCode;
    if (errorCode === "0") break;

    attempts++;
    if (attempts <= maxRetries) {
      console.log(`[GDS:SELL] Error detected (errorCode: ${errorCode}). Retrying ${attempts}/${maxRetries}...`);
      // Espera opcional de 1 segundo entre reintentos
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  send(res, result);
};

// ─── Consulta de boleto ────────────────────────────────────────────────────────

/**
 * GET /api/gds/:provider/tickets/:ticketNumber
 * Query: company (opcional, por defecto usa el proveedor)
 */
exports.queryTicket = async (req, res) => {
  const provider = getProvider(req);
  const { ticketNumber } = req.params;
  const company = req.query.company || provider.toUpperCase();

  const result = await gds.queryTicket(provider, { company, ticketNumber });
  send(res, result);
};

/**
 * GET /api/gds/:provider/tickets/:ticketNumber/qr
 * Query: company
 */
exports.queryTicketQR = async (req, res) => {
  const provider = getProvider(req);
  const { ticketNumber } = req.params;
  const { company } = req.query;

  const result = await gds.queryTicketQR(provider, { company, ticketNumber });
  send(res, result);
};

// ─── Recorrido del servicio ────────────────────────────────────────────────────

/**
 * GET /api/gds/:provider/services/:serviceId/route
 */

exports.getServiceRoute = async (req, res) => {
  const provider = getProvider(req);
  const { serviceId } = req.params;

  if (!serviceId) {
    return res.status(400).json({
      provider,
      operation: 'getServiceRoute',
      status: 'error',
      error: { message: 'Falta parámetro: serviceId' }
    });
  }

  const result = await gds.getServiceRoute(provider, { serviceId });
  send(res, result);
};
