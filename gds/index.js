/**
 * GDS Orchestrator
 *
 * Punto de entrada único del GDS. Recibe el nombre del proveedor y despacha
 * la operación al adaptador correcto. Agregar un nuevo GDS es tan simple como:
 *   1. Crear gds/providers/nuevoGDS/index.js con la misma interfaz
 *   2. Registrarlo en PROVIDERS abajo
 *
 * Todos los métodos devuelven el schema normalizado definido en normalizer.js
 */

const { error } = require('./normalizer');

// ─── Registro de proveedores ───────────────────────────────────────────────────
const PROVIDERS = {
  delta: require('./providers/delta/index')
  // otroGDS: require('./providers/otroGDS/index')   ← así de fácil agregar más
};

/**
 * Obtiene el adaptador del proveedor solicitado.
 * Si no existe, devuelve null y el caller puede manejar el error.
 */
function getProvider(name) {
  const key = (name || '').toLowerCase();
  return PROVIDERS[key] || null;
}

// ─── API pública del GDS ───────────────────────────────────────────────────────

/**
 * Lista los proveedores actualmente disponibles
 */
function listProviders() {
  return Object.keys(PROVIDERS);
}

/**
 * Busca viajes disponibles
 * @param {string} provider
 * @param {{ originId, destinationId, date }} params
 */
async function search(provider, params) {
  const p = getProvider(provider);
  if (!p) return error(provider, 'search', `Proveedor '${provider}' no encontrado`);
  return p.search(params);
}

/**
 * Obtiene disponibilidad de butacas
 */
async function availability(provider, params) {
  const p = getProvider(provider);
  if (!p) return error(provider, 'availability', `Proveedor '${provider}' no encontrado`);
  return p.availability(params);
}

/**
 * Obtiene tarifas del tramo
 */
async function fares(provider, params) {
  const p = getProvider(provider);
  if (!p) return error(provider, 'fares', `Proveedor '${provider}' no encontrado`);
  return p.fares(params);
}

/**
 * Bloquea butacas (inicia proceso de compra)
 */
async function block(provider, params) {
  const p = getProvider(provider);
  if (!p) return error(provider, 'block', `Proveedor '${provider}' no encontrado`);
  return p.block(params);
}

/**
 * Libera butacas bloqueadas
 */
async function unblock(provider, params) {
  const p = getProvider(provider);
  if (!p) return error(provider, 'unblock', `Proveedor '${provider}' no encontrado`);
  return p.unblock(params);
}

/**
 * Emite el boleto
 */
async function sell(provider, params) {
  const p = getProvider(provider);
  if (!p) return error(provider, 'sell', `Proveedor '${provider}' no encontrado`);
  return p.sell(params);
}

/**
 * Consulta un boleto emitido
 */
async function queryTicket(provider, params) {
  const p = getProvider(provider);
  if (!p) return error(provider, 'queryTicket', `Proveedor '${provider}' no encontrado`);
  return p.queryTicket(params);
}

/**
 * Alta de pasajero en el proveedor
 */
async function createPassenger(provider, params) {
  const p = getProvider(provider);
  if (!p) return error(provider, 'createPassenger', `Proveedor '${provider}' no encontrado`);
  return p.createPassenger(params);
}

/**
 * Consulta pasajero por documento
 */
async function findPassenger(provider, params) {
  const p = getProvider(provider);
  if (!p) return error(provider, 'findPassenger', `Proveedor '${provider}' no encontrado`);
  return p.findPassenger(params);
}

/**
 * Catálogos
 */
async function getStops(provider) {
  const p = getProvider(provider);
  if (!p) return error(provider, 'getStops', `Proveedor '${provider}' no encontrado`);
  return p.getStops();
}

async function getCountries(provider) {
  const p = getProvider(provider);
  if (!p) return error(provider, 'getCountries', `Proveedor '${provider}' no encontrado`);
  return p.getCountries();
}

async function getDocTypes(provider) {
  const p = getProvider(provider);
  if (!p) return error(provider, 'getDocTypes', `Proveedor '${provider}' no encontrado`);
  return p.getDocTypes();
}

module.exports = {
  listProviders,
  search,
  availability,
  fares,
  block,
  unblock,
  sell,
  queryTicket,
  createPassenger,
  findPassenger,
  getStops,
  getCountries,
  getDocTypes
};
