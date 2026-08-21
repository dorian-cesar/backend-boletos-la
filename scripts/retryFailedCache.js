const fs = require('fs');
const path = require('path');
require('dotenv').config();

const gds = require('../gds');

const CACHE_FILE = path.join(__dirname, '..', 'data', 'gds_cache.json');
const FAILED_ROUTES_FILE = path.join(__dirname, '..', 'data', 'failed_routes.json');
const PROVIDER = 'delta';

async function runRetryFailed() {
  if (!fs.existsSync(FAILED_ROUTES_FILE)) {
    console.log("No hay rutas fallidas para procesar.");
    return;
  }

  let failedTasks = [];
  try {
    failedTasks = JSON.parse(fs.readFileSync(FAILED_ROUTES_FILE, 'utf8'));
  } catch (e) {
    console.log("Error leyendo failed_routes.json");
    return;
  }

  if (failedTasks.length === 0) {
    console.log("El archivo de fallos está vacío.");
    return;
  }

  console.log(`⚠️ Se encontraron ${failedTasks.length} rutas fallidas. Iniciando reintento con concurrencia 1...`);

  let cache = {};
  if (fs.existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch (e) {}
  }

  const remainingFailed = [];
  let successCount = 0;

  for (const task of failedTasks) {
    try {
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

        if (!cache[task.originId]) cache[task.originId] = {};
        if (!cache[task.originId][task.date]) cache[task.originId][task.date] = [];

        cache[task.originId][task.date].push({
          destinationId: task.destinationId,
          times: times,
          lastServiceTime: times.length > 0 ? times[times.length - 1] : null,
          serviceCount: res.data.trips.length
        });
        
        console.log(`✅ [EXITO] ${task.originId} -> ${task.destinationId} (${task.date}) recuperada.`);
        successCount++;
      } else {
        remainingFailed.push(task);
      }
    } catch (err) {
      console.error(`❌ [FALLO] ${task.originId} -> ${task.destinationId} (${task.date}): ${err.message}`);
      remainingFailed.push(task);
    }

    // Pequeña pausa para no saturar
    await new Promise(r => setTimeout(r, 1000));
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');

  if (remainingFailed.length > 0) {
    console.log(`⚠️ Quedaron ${remainingFailed.length} rutas sin poder resolver.`);
    fs.writeFileSync(FAILED_ROUTES_FILE, JSON.stringify(remainingFailed, null, 2), 'utf8');
  } else {
    console.log(`🎉 Todas las rutas fallidas se recuperaron exitosamente.`);
    fs.unlinkSync(FAILED_ROUTES_FILE); // Borrar el archivo porque ya está limpio
  }
}

if (require.main === module) {
  runRetryFailed().then(() => process.exit(0));
}

module.exports = runRetryFailed;
