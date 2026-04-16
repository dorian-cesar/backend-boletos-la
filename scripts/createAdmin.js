/**
 * Script para crear el primer usuario admin.
 * Ejecutar UNA sola vez: node scripts/createAdmin.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const ADMIN = {
  name: "Admin",
  rut: "11111111-1",
  email: "admin@wit.la",
  password: "witla951",
  role: "superAdmin",
  activo: true,
};

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Conectado a MongoDB");

  const exists = await User.findOne({ email: ADMIN.email });
  if (exists) {
    console.log("El usuario ya existe:", ADMIN.email);
    process.exit(0);
  }

  // El modelo hashea la password automáticamente en el pre-save hook
  await User.create(ADMIN);

  console.log("✅ Usuario creado:");
  console.log("   Email:", ADMIN.email);
  console.log("   Password:", ADMIN.password);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
