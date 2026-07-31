/**
 * Delta API Client
 *
 * Realiza llamadas HTTP GET al Web Service de Delta (ASMX).
 * No requiere dependencias externas: usa el módulo 'http' nativo de Node.js.
 *
 * Todas las credenciales se inyectan automáticamente desde .env
 * para que los controllers nunca tengan que manejarlas.
 */

const http = require('http');

const BASE_URL = process.env.DELTA_API_URL || 'http://38.247.139.43/WSdelta_Bol/wsdelta.asmx';

/**
 * Resuelve la agencia a utilizar según el canal o código pasado.
 */
function getAgencia(agenciaOpt) {
  const opt = String(agenciaOpt || '').toLowerCase();
  if (opt === 'totem') {
    return process.env.DELTA_AGENCIA_TOTEM || 'BO1';
  }
  if (opt === 'web') {
    return process.env.DELTA_AGENCIA_WEB || 'BO2';
  }
  // Si envían directamente el código ("BO1", "BO2") o si no se especificó nada
  return agenciaOpt || process.env.DELTA_AGENCIA_WEB || process.env.DELTA_AGENCIA || 'BO2';
}

/**
 * Hace un GET al endpoint de Delta y devuelve el XML crudo como string.
 * @param {string} method - Nombre del método del WS (ej: 'ObtenerServicios')
 * @param {object} params - Parámetros adicionales (sin credenciales)
 * @returns {Promise<string>} XML crudo de la respuesta
 */
function call(method, params = {}) {
  const { agencia: agenciaOpt, channel, agencyType, ...cleanParams } = params;

  const credentials = {
    Agencia: getAgencia(agenciaOpt || channel || agencyType),
    Usuario: process.env.DELTA_USUARIO,
    Password: process.env.DELTA_PASSWORD
  };

  const allParams = { ...credentials, ...cleanParams };
  const query = Object.entries(allParams)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const url = new URL(`${BASE_URL}/${method}`);
  url.search = query;

  return new Promise((resolve, reject) => {
    http.get(url.toString(), (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`Delta HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
        resolve(data);
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Métodos disponibles del WS, mapeados con sus parámetros.
 * Uso: deltaClient.obtenerServicios({ IdParadas_Origen: 1, IdParadas_Destino: 5, Fecha: '2026-04-15' })
 */
module.exports = {
  // Catálogos
  obtenerParadasHomologadas: () => call('ObtenerParadasHomologadas'),
  paisesGrilla: () => call('PaisesGrilla'),
  tiposDocumentoGrilla: () => call('TiposDocumentoGrilla'),
  calidadConsulta: (p) => call('CalidadConsulta', p),

  // Búsqueda
  obtenerServicios: (p) => call('ObtenerServicios', p),
  serviciosRecorrido: (p) => call('ServiciosRecorrido', p),

  // Asientos y tarifas
  obtenerTaquilla: (p) => call('ObtenerTaquilla', p),
  obtenerTarifas: (p) => call('ObtenerTarifas', p),

  // Bloqueo
  generadorNroConexion: () => call('GeneradorNroConexion'),
  bloquearButacas: (p) => call('BloquearButacas', p),
  desbloquearButacas: (p) => call('DesbloquearButacas', p),

  // Pasajeros
  pasajerosAlta: (p) => call('PasajerosAlta', p),
  pasajerosConsulta: (p) => call('Pasajeros_Consulta', p),

  // Venta
  boletosProximoNumeroLibre: (p) => call('BoletosProximoNumeroLibre', p),
  venta3: (p) => call('Venta3', p),

  // Consulta de boletos
  boletosConsultar: (p) => call('BoletosConsultar', p),
  boletosConsultarQR: (p) => call('Boletos_ConsultarQR', p),

  // Facturación
  rg3550Consulta: (p) => call('RG3550Consulta', p),
  rg3550Alta: (p) => call('RG3550Alta', p),
  empresasParaPasajesAlta: (p) => call('EmpresasParaPasajes_Alta', p),
  empresasParaPasajesConsulta: (p) => call('EmpresasParaPasajes_Consulta', p),
  pasajesFacturaAEmpresa: (p) => call('PasajesFacturaAEmpresa', p),

  // Util interno
  _call: call
};
