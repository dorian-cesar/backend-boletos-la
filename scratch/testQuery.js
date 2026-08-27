const mongoose = require('mongoose');
require('dotenv').config();
const RouteMaster = require('../models/RouteMaster');
require('../models/City');

async function test() {
  const uri = process.env.MONGO_URI.replace('127.0.0.1', 'localhost');
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  
  const routes = await RouteMaster.find().populate('origin').lean();
  const originsSet = new Set();
  routes.forEach(route => {
    if (route.origin && route.origin.name) originsSet.add(route.origin.name);
  });
  
  console.log("=== ORÍGENES ===");
  console.log(Array.from(originsSet).sort());
  mongoose.disconnect();
}
test().catch(console.error);
