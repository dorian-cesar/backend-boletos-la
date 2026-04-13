/**
 * GDS Normalizer
 * Define el schema único de respuesta para todas las operaciones del GDS,
 * sin importar qué proveedor subyacente se use (Delta, otro GDS, etc.)
 */

const { v4: uuidv4 } = require('crypto').randomUUID ? { v4: () => require('crypto').randomUUID() } : { v4: () => `${Date.now()}-${Math.random().toString(36).slice(2)}` };

/**
 * Construye una respuesta exitosa normalizada
 * @param {string} provider - Nombre del proveedor (ej: 'delta')
 * @param {string} operation - Operación ejecutada (ej: 'search', 'block', 'sell')
 * @param {object} data - Payload de la respuesta
 * @returns {object}
 */
function success(provider, operation, data) {
  return {
    provider,
    operation,
    success: true,
    status: 'success',
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: genId()
    }
  };
}

/**
 * Construye una respuesta de error normalizada
 * @param {string} provider
 * @param {string} operation
 * @param {string} message - Mensaje de error legible
 * @param {object} [details] - Info extra de debug (opcional)
 */
function error(provider, operation, message, details = null) {
  const resp = {
    provider,
    operation,
    success: false,
    status: 'error',
    error: { message },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: genId()
    }
  };
  if (details) resp.error.details = details;
  return resp;
}

function genId() {
  try {
    return require('crypto').randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

// ─── Schemas de referencia (documentación viva) ───────────────────────────────

/**
 * SEARCH — Lista de viajes disponibles
 * data: {
 *   trips: [{
 *     id: string,           // ID interno del proveedor
 *     provider: string,
 *     origin: { id, name },
 *     destination: { id, name },
 *     departureTime: string (ISO),
 *     arrivalTime: string|null,
 *     durationMinutes: number|null,
 *     company: string,
 *     serviceClass: string,  // 'normal' | 'cama' | 'semi-cama' | etc.
 *     availableSeats: number,
 *     totalSeats: number|null,
 *     currency: string,
 *     minFare: number|null,
 *     raw: object            // datos originales del proveedor (debug)
 *   }]
 * }
 *
 * AVAILABILITY — Mapa de butacas
 * data: {
 *   serviceId: string,
 *   floors: [{
 *     floor: number,
 *     seats: [{
 *       id: string,
 *       number: string,
 *       status: 'available'|'occupied'|'blocked',
 *       type: string,
 *       row: number|null,
 *       column: number|null
 *     }]
 *   }]
 * }
 *
 * FARES — Tarifas del tramo
 * data: {
 *   serviceId: string,
 *   fares: [{
 *     id: string,
 *     name: string,
 *     price: number,
 *     currency: string,
 *     conditions: string|null
 *   }]
 * }
 *
 * BLOCK — Bloqueo de butacas
 * data: {
 *   connectionId: string,
 *   blockedSeats: [string],
 *   expiresAt: string|null
 * }
 *
 * UNBLOCK — Liberación de butacas
 * data: {
 *   connectionId: string,
 *   released: boolean
 * }
 *
 * SELL — Emisión de boleto
 * data: {
 *   tickets: [{
 *     ticketNumber: string,
 *     passenger: { name, lastName, docType, docNumber },
 *     seat: string,
 *     origin: { id, name },
 *     destination: { id, name },
 *     departureTime: string,
 *     totalAmount: number,
 *     currency: string,
 *     issuedAt: string
 *   }]
 * }
 *
 * TICKET — Consulta de boleto
 * data: {
 *   ticketNumber: string,
 *   status: string,
 *   passenger: object,
 *   trip: object,
 *   raw: object
 * }
 */

module.exports = { success, error };
