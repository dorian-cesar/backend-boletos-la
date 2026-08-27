const cron = require('node-cron');
const runCacheGenerator = require('../scripts/gdsCacheGenerator');

function startGdsCacheCron() {
    // Ejecutar todos los días a las 01:00 AM
    cron.schedule('0 1 * * *', async () => {
        try {
            console.log('[CRON-GDS-CACHE] Iniciando generación de caché de GDS...', new Date().toLocaleString('es-PY', { timeZone: 'America/Asuncion' }));
            
            await runCacheGenerator();
            
            console.log('[CRON-GDS-CACHE] Generación de caché finalizada con éxito.');
        } catch (err) {
            console.error('[CRON-GDS-CACHE] Error en el cron de generación de caché GDS:', err);
        }
    }, {
        timezone: "America/Asuncion"
    });

    console.log("[CRON-GDS-CACHE] Cron de caché GDS programado para las 01:00 AM (Horario Paraguay)");
}

module.exports = startGdsCacheCron;
