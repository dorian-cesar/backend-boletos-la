const cron = require('node-cron');
const runCacheGenerator = require('../scripts/gdsCacheGenerator');

function startGdsCacheCron() {
    // Ejecutar todos los días a las 02:00 AM
    cron.schedule('0 2 * * *', async () => {
        try {
            console.log('[CRON-GDS-CACHE] Iniciando generación de caché de GDS...', new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' }));
            
            await runCacheGenerator();
            
            console.log('[CRON-GDS-CACHE] Generación de caché finalizada con éxito.');
        } catch (err) {
            console.error('[CRON-GDS-CACHE] Error en el cron de generación de caché GDS:', err);
        }
    }, {
        timezone: "America/Santiago"
    });

    console.log("[CRON-GDS-CACHE] Cron de caché GDS programado para las 02:00 AM");
}

module.exports = startGdsCacheCron;
