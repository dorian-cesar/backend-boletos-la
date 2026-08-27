require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });

    const [rows] = await conn.execute('SELECT COUNT(DISTINCT origin, destination) as total_rutas FROM route_services_availability');
    const [rows2] = await conn.execute('SELECT COUNT(*) as total_combinaciones FROM route_services_availability');
    
    console.log(`Rutas únicas mapeadas (origen -> destino): ${rows[0].total_rutas}`);
    console.log(`Combinaciones totales (rutas x fechas): ${rows2[0].total_combinaciones}`);
    
    await conn.end();
  } catch (err) {
    console.error(err);
  }
}

main();
