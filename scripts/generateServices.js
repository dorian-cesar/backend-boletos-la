/**
 * Script para ejecutar manualmente la generación de servicios para todas las rutas activas.
 * Ejecución: node scripts/generateServices.js o npm run generate-services
 */

require("dotenv").config();
const mongoose = require("mongoose");

// Es necesario requerir los modelos para registrarlos en Mongoose antes de realizar queries con populate
require("../models/City");
require("../models/BusLayout");
require("../models/RouteMaster");
require("../models/Seat");
require("../models/Service");

const { generateAllServices } = require("../utils/serviceGenerator");

async function main() {
  console.log("🚀 Iniciando generación manual de servicios...");
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/gestion_transporte";
  
  await mongoose.connect(mongoUri);
  console.log("🔌 Conectado a MongoDB");

  await generateAllServices();

  console.log("✅ Proceso de generación de servicios completado.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error en la generación de servicios:", err);
  process.exit(1);
});
