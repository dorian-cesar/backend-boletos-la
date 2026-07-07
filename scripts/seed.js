/**
 * Script para poblar la base de datos con datos de prueba de Chile.
 * Genera:
 * - 7 Ciudades chilenas
 * - 2 Layouts de bus (1 piso Semi Cama y 2 pisos Mix Cama)
 * - 2 Rutas maestras con 4 ciudades cada una
 * - Genera los servicios correspondientes para los próximos 14 días
 * 
 * Ejecución: npm run seed o node scripts/seed.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const City = require("../models/City");
const BusLayout = require("../models/BusLayout");
const RouteMaster = require("../models/RouteMaster");
const Seat = require("../models/Seat");
const Service = require("../models/Service");
const { generateServicesForRoute } = require("../utils/serviceGenerator");

async function main() {
  console.log("🚀 Iniciando el proceso de seeding...");
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/gestion_transporte";
  
  await mongoose.connect(mongoUri);
  console.log("🔌 Conectado a MongoDB en:", mongoUri);

  // 1. Limpieza de base de datos
  console.log("🧹 Limpiando base de datos...");
  await Seat.deleteMany({});
  await Service.deleteMany({});
  await RouteMaster.deleteMany({});
  await BusLayout.deleteMany({});
  await City.deleteMany({});
  console.log("✅ Limpieza completada.");

  // 2. Crear Ciudades
  console.log("🇨🇱 Creando ciudades de Chile...");
  const citiesData = [
    { name: "Santiago", code: "SCL", region: "Metropolitana", active: true },
    { name: "Rancagua", code: "RAN", region: "O'Higgins", active: true },
    { name: "Curicó", code: "CUR", region: "Maule", active: true },
    { name: "Talca", code: "TAL", region: "Maule", active: true },
    { name: "Quillota", code: "QTA", region: "Valparaíso", active: true },
    { name: "Viña del Mar", code: "VIN", region: "Valparaíso", active: true },
    { name: "Valparaíso", code: "VAL", region: "Valparaíso", active: true }
  ];

  const createdCities = {};
  for (const c of citiesData) {
    const city = await City.create(c);
    createdCities[c.code] = city;
    console.log(`   - Ciudad creada: ${city.name} (${city.code})`);
  }

  // 3. Crear Layouts de Bus
  console.log("🚌 Creando layouts de bus...");

  // Layout 1: Semi Cama 1 Piso (44 Asientos)
  // Matriz de 11 filas x 4 columnas con pasillo central (columna 3 vacía)
  const floor1SemiCama = [];
  let seatCounter = 1;
  for (let r = 0; r < 11; r++) {
    const row = [
      String(seatCounter++),
      String(seatCounter++),
      "", // Pasillo
      String(seatCounter++),
      String(seatCounter++)
    ];
    floor1SemiCama.push(row);
  }

  const layout1Data = {
    name: "Semi Cama 1 Piso (44 Asientos)",
    rows: 11,
    columns: 4,
    pisos: 1,
    capacidad: 44,
    tipo_Asiento_piso_1: "Semi Cama",
    floor1: {
      seatMap: floor1SemiCama
    }
  };
  const layout1 = await BusLayout.create(layout1Data);
  console.log(`   - Layout creado: ${layout1.name}`);

  // Layout 2: Mix Cama 2 Pisos (40 Asientos: 12 Cama en piso 1, 28 Semi Cama en piso 2)
  // Piso 1: 4 filas x 3 columnas (ej: 2 asientos - pasillo - 1 asiento)
  const floor1Mix = [];
  let seatPiso1 = 1;
  for (let r = 0; r < 4; r++) {
    const row = [
      String(seatPiso1++),
      String(seatPiso1++),
      "", // Pasillo
      String(seatPiso1++)
    ];
    floor1Mix.push(row);
  }

  // Piso 2: 7 filas x 4 columnas (2 asientos - pasillo - 2 asientos)
  const floor2Mix = [];
  let seatPiso2 = 13;
  for (let r = 0; r < 7; r++) {
    const row = [
      String(seatPiso2++),
      String(seatPiso2++),
      "", // Pasillo
      String(seatPiso2++),
      String(seatPiso2++)
    ];
    floor2Mix.push(row);
  }

  const layout2Data = {
    name: "Mix Cama 2 Pisos (40 Asientos)",
    rows: 11,
    columns: 4,
    pisos: 2,
    capacidad: 40,
    tipo_Asiento_piso_1: "Salón Cama",
    tipo_Asiento_piso_2: "Semi Cama",
    floor1: {
      seatMap: floor1Mix
    },
    floor2: {
      seatMap: floor2Mix
    }
  };
  const layout2 = await BusLayout.create(layout2Data);
  console.log(`   - Layout creado: ${layout2.name}`);

  // 4. Crear Rutas Maestras (RouteMaster)
  console.log("🛣️ Creando rutas maestras...");

  // Ruta 1: Santiago -> Rancagua -> Curicó -> Talca
  const route1Data = {
    name: "Ruta Santiago - Talca (Diurno)",
    origin: createdCities["SCL"]._id,
    destination: createdCities["TAL"]._id,
    startTime: 480, // 08:00 AM (480 minutos)
    durationMinutes: 300, // 5 horas
    layout: layout1._id,
    stops: [
      {
        city: createdCities["RAN"]._id,
        order: 1,
        offsetMinutes: 90, // Llega a Rancagua en 1h30m (9:30 AM)
        price: 5000,
        isOrigin: false,
        isDestination: false
      },
      {
        city: createdCities["CUR"]._id,
        order: 2,
        offsetMinutes: 210, // Llega a Curicó en 3h30m (11:30 AM)
        price: 8000,
        isOrigin: false,
        isDestination: false
      }
    ],
    schedule: {
      active: true,
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7], // Diariamente
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días de vigencia
      horizonDays: 14 // Generar servicios para 14 días
    }
  };

  const route1 = await RouteMaster.create(route1Data);
  console.log(`   - Ruta creada: ${route1.name}`);

  // Ruta 2: Santiago -> Quillota -> Viña del Mar -> Valparaíso
  const route2Data = {
    name: "Ruta Santiago - Valparaíso (Nocturno)",
    origin: createdCities["SCL"]._id,
    destination: createdCities["VAL"]._id,
    startTime: 1200, // 20:00 / 8:00 PM (1200 minutos)
    durationMinutes: 180, // 3 horas
    layout: layout2._id,
    stops: [
      {
        city: createdCities["QTA"]._id,
        order: 1,
        offsetMinutes: 90, // Llega a Quillota a las 21:30
        price: 4500,
        isOrigin: false,
        isDestination: false
      },
      {
        city: createdCities["VIN"]._id,
        order: 2,
        offsetMinutes: 140, // Llega a Viña del Mar a las 22:20
        price: 6000,
        isOrigin: false,
        isDestination: false
      }
    ],
    schedule: {
      active: true,
      daysOfWeek: [1, 2, 3, 4, 5, 6, 7], // Diariamente
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      horizonDays: 14
    }
  };

  const route2 = await RouteMaster.create(route2Data);
  console.log(`   - Ruta creada: ${route2.name}`);

  // 5. Generar Servicios y Asientos
  console.log("⚙️ Generando servicios y asientos correspondientes...");
  
  // Para que el generador de servicios funcione, requiere que la ruta tenga populadas las relaciones
  const populatedRoute1 = await RouteMaster.findById(route1._id)
    .populate('origin')
    .populate('destination')
    .populate('stops.city')
    .populate('layout');

  const populatedRoute2 = await RouteMaster.findById(route2._id)
    .populate('origin')
    .populate('destination')
    .populate('stops.city')
    .populate('layout');

  console.log(`⏳ Generando servicios para la ruta: ${populatedRoute1.name}`);
  const servicesRoute1 = await generateServicesForRoute(populatedRoute1);
  console.log(`   - Creados ${servicesRoute1.length} servicios para la Ruta 1.`);

  console.log(`⏳ Generando servicios para la ruta: ${populatedRoute2.name}`);
  const servicesRoute2 = await generateServicesForRoute(populatedRoute2);
  console.log(`   - Creados ${servicesRoute2.length} servicios para la Ruta 2.`);

  console.log("🎉 Seeding finalizado con éxito.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error durante el seeding:", err);
  process.exit(1);
});
