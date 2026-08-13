require('dotenv').config();
const mongoose = require('mongoose');
const mysql = require('mysql2/promise');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const tz = require('dayjs/plugin/timezone');

// Extender dayjs para manejo de zonas horarias
dayjs.extend(utc);
dayjs.extend(tz);
const TZ = 'America/Santiago'; // Misma zona horaria del sistema

const RouteMaster = require('../models/RouteMaster');
const Service = require('../models/Service');
require('../models/City');

async function main() {
  console.log('Iniciando script de sincronización de analítica (Versión Optimizada)...');
  const startTime = Date.now();

  try {
    // 1. Conectar a MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Conectado a MongoDB local.');
    
    // 2. Conectar a MySQL RDS
    var mysqlConn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });
    console.log('✅ Conectado a MySQL RDS (Analítica).');

    // 3. Crear la tabla
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS route_services_availability (
        id INT AUTO_INCREMENT PRIMARY KEY,
        origin VARCHAR(255) NOT NULL,
        destination VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        service_count INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_route_date (origin, destination, date)
      );
    `;
    await mysqlConn.execute(createTableQuery);

    // 4. Determinar el rango de fechas (hoy hasta hoy + 6 días)
    const today = dayjs().tz(TZ).startOf('day');
    const startRange = today.toDate();
    const endRange = today.add(6, 'day').endOf('day').toDate();

    console.log(`Buscando todos los servicios entre ${today.format('YYYY-MM-DD')} y ${today.add(6, 'day').format('YYYY-MM-DD')}...`);

    // 5. OBTENER TODOS los servicios en esos 7 días en UNA SOLA CONSULTA
    const allServices = await Service.find({
      date: { $gte: startRange, $lte: endRange }
    }).lean();

    console.log(`Encontrados ${allServices.length} servicios programados en los próximos 7 días. Procesando combinaciones...`);

    // 6. Mapa en memoria para contar las combinaciones
    // Estructura: counts["ORIGEN|DESTINO|YYYY-MM-DD"] = cantidad
    const countsMap = {};

    for (const service of allServices) {
      // Extraemos la fecha del servicio
      const serviceDate = dayjs(service.date).tz(TZ).format('YYYY-MM-DD');
      
      const departures = service.departures || [];
      // Ordenamos las paradas por si acaso (basado en 'order')
      departures.sort((a, b) => a.order - b.order);

      // Revisamos todas las posibles combinaciones de origen->destino dentro de este servicio
      for (let i = 0; i < departures.length; i++) {
        for (let j = i + 1; j < departures.length; j++) {
          const originStop = departures[i].stop;
          const destStop = departures[j].stop;
          
          if (originStop && destStop) {
            const key = `${originStop}|${destStop}|${serviceDate}`;
            countsMap[key] = (countsMap[key] || 0) + 1;
          }
        }
      }
    }

    // 7. Preparar los datos para inserción masiva (Bulk Insert) en MySQL
    const entries = Object.entries(countsMap);
    if (entries.length > 0) {
      console.log(`Se insertarán/actualizarán ${entries.length} combinaciones únicas en RDS...`);
      
      const values = [];
      const flatData = [];
      
      for (const [key, count] of entries) {
        const [origin, destination, dateStr] = key.split('|');
        values.push('(?, ?, ?, ?)');
        flatData.push(origin, destination, dateStr, count);
      }

      // Query para hacer insert múltiple y actualizar si ya existe la llave
      const bulkInsertQuery = `
        INSERT INTO route_services_availability (origin, destination, date, service_count)
        VALUES ${values.join(', ')}
        ON DUPLICATE KEY UPDATE service_count = VALUES(service_count)
      `;

      await mysqlConn.execute(bulkInsertQuery, flatData);
      console.log(`🎉 Proceso terminado exitosamente. ${entries.length} combinaciones guardadas.`);
    } else {
      console.log('No se encontraron servicios con paradas válidas para estos días.');
    }

  } catch (err) {
    console.error('❌ Error durante el procesamiento de datos:', err);
  } finally {
    if (mongoose.connection.readyState === 1) await mongoose.disconnect();
    if (mysqlConn) await mysqlConn.end();
    
    const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Tiempo total de ejecución: ${timeTaken} segundos.`);
    process.exit(0);
  }
}

main();
