const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
require('dotenv').config();

const gds = require('../gds'); // Importamos el orquestador GDS

const CACHE_FILE = path.join(__dirname, '..', 'data', 'gds_cache.json');
const PROVIDER = 'delta'; // Proveedor por defecto
const DAYS_TO_CACHE = 7;
const CONCURRENCY_LIMIT = 5; // Peticiones simultáneas a Delta

// Helper para limitar concurrencia de promesas
async function asyncPool(poolLimit, array, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item, array));
    ret.push(p);
    if (poolLimit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

async function runCacheGenerator() {
  console.log("🚀 Iniciando generador de caché de destinos GDS...");
  const startTime = Date.now();

  try {
    // Asegurar que exista la carpeta data/
    const dataDir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 1. Obtener todas las paradas (orígenes/destinos)
    const resultStops = await gds.getStops(PROVIDER, { channel: 'web' });
    if (!resultStops || resultStops.status !== 'success' || !resultStops.data || !resultStops.data.stops) {
      throw new Error("No se pudieron obtener las paradas del GDS");
    }

    const stops = resultStops.data.stops;
    console.log(`📍 Se encontraron ${stops.length} paradas.`);

    // 2. Generar lista de fechas
    const dates = [];
    for (let i = 0; i < DAYS_TO_CACHE; i++) {
      dates.push(dayjs().add(i, 'day').format('YYYY-MM-DD'));
    }
    console.log(`📅 Analizando fechas: ${dates.join(', ')}`);

    // 3. Crear el array de tareas
    // Para cada origen, para cada fecha, para cada destino (origen != destino)
    const tasks = [];
    for (const origin of stops) {
      for (const date of dates) {
        for (const destination of stops) {
          if (origin.id !== destination.id) {
            tasks.push({
              originId: origin.id,
              destinationId: destination.id,
              date: date
            });
          }
        }
      }
    }

    console.log(`⚙️  Total de combinaciones a evaluar: ${tasks.length}`);
    console.log(`⏱️  Usando concurrencia de ${CONCURRENCY_LIMIT} peticiones simultáneas.`);

    // Objeto final de caché: { originId: { date: [destId1, destId2] } }
    const cache = {};

    let completed = 0;
    
    // Función de iteración
    const processTask = async (task) => {
      try {
        const res = await gds.search(PROVIDER, {
          originId: task.originId,
          destinationId: task.destinationId,
          date: task.date,
          channel: 'web'
        });

        // Inicializar estructura si no existe
        if (!cache[task.originId]) cache[task.originId] = {};
        if (!cache[task.originId][task.date]) cache[task.originId][task.date] = [];

        // Si devuelve viajes, agregamos el destino a los disponibles
        if (res && res.status === 'success' && res.data && res.data.trips && res.data.trips.length > 0) {
          cache[task.originId][task.date].push(task.destinationId);
        }
      } catch (err) {
        // Ignoramos errores puntuales para no detener el proceso masivo
        console.error(`Error consultando origen ${task.originId} a destino ${task.destinationId}: ${err.message}`);
      }

      completed++;
      if (completed % 1000 === 0) {
        const percent = ((completed / tasks.length) * 100).toFixed(2);
        console.log(`   Procesadas ${completed} de ${tasks.length} peticiones (${percent}%)`);
      }
    };

    // 4. Ejecutar todas las peticiones con control de concurrencia
    await asyncPool(CONCURRENCY_LIMIT, tasks, processTask);

    // 5. Guardar el archivo final
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
    
    const durationMins = ((Date.now() - startTime) / 60000).toFixed(2);
    console.log(`✅ Caché generada exitosamente en ${durationMins} minutos.`);
    console.log(`📁 Archivo guardado en: ${CACHE_FILE}`);

  } catch (error) {
    console.error("❌ Error catastrófico en el generador de caché:", error);
    process.exit(1);
  }
}

// Permitir importación o ejecución directa
if (require.main === module) {
  runCacheGenerator().then(() => process.exit(0));
}

module.exports = runCacheGenerator;
