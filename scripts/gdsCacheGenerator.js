const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
require('dotenv').config();

const gds = require('../gds'); // Importamos el orquestador GDS

const CACHE_FILE = path.join(__dirname, '..', 'data', 'gds_cache.json');
const FAILED_ROUTES_FILE = path.join(__dirname, '..', 'data', 'failed_routes.json');
const PROVIDER = 'delta'; // Proveedor por defecto
const DAYS_TO_CACHE = 7;
const CONCURRENCY_LIMIT = 5; // Bajado para evitar Timeouts en Delta // Aumentado porque ya no bloquean

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

    // Priorizar Asunción (Id: 184)
    stops.sort((a, b) => {
      const aId = String(a.id || a.Id);
      const bId = String(b.id || b.Id);
      if (aId === '184') return -1;
      if (bId === '184') return 1;
      return 0;
    });

    // 2. Generar lista de fechas
    const dates = [];
    for (let i = 0; i < DAYS_TO_CACHE; i++) {
      dates.push(dayjs().add(i, 'day').format('YYYY-MM-DD'));
    }
    console.log(`📅 Analizando fechas: ${dates.join(', ')}`);

    let cache = {};
    if (fs.existsSync(CACHE_FILE)) {
      try {
        cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      } catch (e) {}
    }

    let completed = 0;
    const totalCombinations = stops.length * dates.length * (stops.length - 1);
    console.log(`⚙️  Total de combinaciones a evaluar: ${totalCombinations}`);
    console.log(`⏱️  Usando concurrencia de ${CONCURRENCY_LIMIT} peticiones simultáneas.`);

    for (const origin of stops) {
      const oId = origin.id || origin.Id;
      if (!oId) continue;

      const originName = origin.name || origin.Descripcion || oId;
      console.log(`\n▶️  Procesando origen: ${originName} (Id: ${oId})`);

      const tasks = [];
      const failedTasks = [];
      for (const date of dates) {
        for (const destination of stops) {
          const dId = destination.id || destination.Id;
          if (dId && oId !== dId) {
            tasks.push({ originId: oId, destinationId: dId, date: date });
          }
        }
      }

      // Reiniciamos/Preparamos la estructura para este origen
      cache[oId] = {};
      for (const date of dates) {
        cache[oId][date] = [];
      }

      const processTask = async (task) => {
        
        let success = false;
        let attempts = 0;
        
        while (!success && attempts < 3) {
          try {
            attempts++;
            const res = await gds.search(PROVIDER, {
              originId: task.originId,
              destinationId: task.destinationId,
              date: task.date,
              channel: 'web'
            });
            
            if (res && res.status === 'success' && res.data && res.data.trips && res.data.trips.length > 0) {
              const times = Array.from(new Set(res.data.trips.map(trip => {
                if (trip.departureDisplay) {
                  const parts = trip.departureDisplay.split(' ');
                  if (parts.length > 1) return parts[1];
                }
                if (trip.departureTime) {
                  const dt = new Date(trip.departureTime);
                  if (!isNaN(dt.getTime())) return dt.toISOString().substr(11, 5);
                }
                return null;
              }).filter(Boolean))).sort();

              cache[task.originId][task.date].push({
                destinationId: task.destinationId,
                times: times,
                lastServiceTime: times.length > 0 ? times[times.length - 1] : null,
                serviceCount: res.data.trips.length
              });
            }
            success = true; // Funcionó sin error, salimos del while
          } catch (err) {
            if (attempts >= 3) {
              console.error(`\n[ERROR] Falló tras 3 intentos en ${task.originId} -> ${task.destinationId} el ${task.date}: ${err.message}`);
              failedTasks.push(task);
            } else {
              // Pequeña pausa antes del reintento
              await new Promise(r => setTimeout(r, 1500));
            }
          }
        }
        completed++;
        if (completed % 500 === 0) {
          const percent = ((completed / totalCombinations) * 100).toFixed(2);
          process.stdout.write(` [${percent}%] `);
        }
      };

      // Ejecutamos las peticiones para este origen
      await asyncPool(CONCURRENCY_LIMIT, tasks, processTask);
      
      // Guardar el archivo progresivamente
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
      // Append failed tasks for this origin to failed_routes.json
      if (failedTasks.length > 0) {
        let allFailed = [];
        if (fs.existsSync(FAILED_ROUTES_FILE)) {
          try {
            allFailed = JSON.parse(fs.readFileSync(FAILED_ROUTES_FILE, 'utf8'));
          } catch(e) {}
        }
        allFailed = allFailed.concat(failedTasks);
        fs.writeFileSync(FAILED_ROUTES_FILE, JSON.stringify(allFailed, null, 2), 'utf8');
      }

      console.log(`\n✅ Caché actualizado para origen ${originName}.`);
    }
    const durationMins = ((Date.now() - startTime) / 60000).toFixed(2);
    console.log(`\n✅ Caché generada totalmente en ${durationMins} minutos.`);
    console.log(`📁 Archivo final guardado en: ${CACHE_FILE}`);

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
