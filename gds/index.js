/**
 * GDS Orchestrator
 *
 * Punto de entrada único del GDS. Recibe el nombre del proveedor y despacha
 * la operación al adaptador correcto.
 *
 * Agregar un nuevo proveedor:
 *   1. Crear gds/providers/nuevoGDS/index.js con la misma interfaz
 *   2. Registrarlo en PROVIDERS abajo
 */

const { error } = require("./normalizer");

// ─── Registro de proveedores ───────────────────────────────────────────────────
const PROVIDERS = {
  delta: require("./providers/delta/index"),
  // otroGDS: require('./providers/otroGDS/index')
};

function getProvider(name) {
  return PROVIDERS[(name || "").toLowerCase()] || null;
}

function listProviders() {
  return Object.keys(PROVIDERS);
}

// ─── Catálogos ─────────────────────────────────────────────────────────────────

async function getStops(provider) {
  const p = getProvider(provider);
  if (!p)
    return error(provider, "getStops", `Proveedor '${provider}' no encontrado`);
  return p.getStops();
}

async function getCountries(provider) {
  const p = getProvider(provider);
  if (!p)
    return error(
      provider,
      "getCountries",
      `Proveedor '${provider}' no encontrado`,
    );
  return p.getCountries();
}

async function getDocTypes(provider) {
  const p = getProvider(provider);
  if (!p)
    return error(
      provider,
      "getDocTypes",
      `Proveedor '${provider}' no encontrado`,
    );
  return p.getDocTypes();
}

// ─── Búsqueda ──────────────────────────────────────────────────────────────────

async function search(provider, params) {
  const p = getProvider(provider);
  if (!p)
    return error(provider, "search", `Proveedor '${provider}' no encontrado`);
  return p.search(params);
}

// ─── Disponibilidad ────────────────────────────────────────────────────────────

async function availability(provider, params) {
  const p = getProvider(provider);
  if (!p)
    return error(
      provider,
      "availability",
      `Proveedor '${provider}' no encontrado`,
    );
  return p.availability(params);
}

async function fares(provider, params) {
  const p = getProvider(provider);
  if (!p)
    return error(provider, "fares", `Proveedor '${provider}' no encontrado`);
  return p.fares(params);
}

// ─── Bloqueo ───────────────────────────────────────────────────────────────────

async function block(provider, params) {
  const p = getProvider(provider);
  if (!p)
    return error(provider, "block", `Proveedor '${provider}' no encontrado`);
  return p.block(params);
}

async function unblock(provider, params) {
  const p = getProvider(provider);
  if (!p)
    return error(provider, "unblock", `Proveedor '${provider}' no encontrado`);
  return p.unblock(params);
}

// ─── Pasajeros ─────────────────────────────────────────────────────────────────

async function createPassenger(provider, params) {
  const p = getProvider(provider);
  if (!p)
    return error(
      provider,
      "createPassenger",
      `Proveedor '${provider}' no encontrado`,
    );
  return p.createPassenger(params);
}

async function findPassenger(provider, params) {
  const p = getProvider(provider);
  if (!p)
    return error(
      provider,
      "findPassenger",
      `Proveedor '${provider}' no encontrado`,
    );
  return p.findPassenger(params);
}

// ─── Venta ─────────────────────────────────────────────────────────────────────

async function sell(provider, params) {
  const p = getProvider(provider);
  if (!p)
    return error(provider, "sell", `Proveedor '${provider}' no encontrado`);
  return p.sell(params);
}

// ─── Consulta de boleto ────────────────────────────────────────────────────────

async function queryTicket(provider, params) {
  const p = getProvider(provider);
  if (!p)
    return error(
      provider,
      "queryTicket",
      `Proveedor '${provider}' no encontrado`,
    );
  return p.queryTicket(params);
}

async function queryTicketQR(provider, params) {
  const p = getProvider(provider);
  if (!p)
    return error(
      provider,
      "queryTicketQR",
      `Proveedor '${provider}' no encontrado`,
    );
  return p.queryTicketQR(params);
}


async function generateConnection(provider) {
  const p = getProvider(provider);
  if (!p)
    return error(provider, 'generateConnection', `Proveedor '${provider}' no encontrado`);
  return p.generateConnectionId();
}

async function getServiceRoute(provider, params) {
  const p = getProvider(provider);
  if (!p)
    return error(provider, 'getServiceRoute', `Proveedor '${provider}' no encontrado`);
  return p.getServiceRoute(params);
}

module.exports = {
  listProviders,
  getStops,
  getCountries,
  getDocTypes,
  search,
  availability,
  fares,
  generateConnection,
  block,
  unblock,
  createPassenger,
  findPassenger,
  sell,
  queryTicket,
  queryTicketQR,
  getServiceRoute,
};
