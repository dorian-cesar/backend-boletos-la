require('dotenv').config();
const deltaClient = require('../gds/providers/delta/client');
const mapper = require('../gds/providers/delta/mapper');

async function test() {
  try {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const xml = await deltaClient.obtenerServicios({
      IdParadas_Origen: 184, // Asuncion
      IdParadas_Destino: 0,
      Fecha: tomorrow
    });
    const rows = mapper.parseDataSet(xml, "ServiciosxDiaId");
    console.log("Número de filas:", rows.length);
    console.log(rows);
  } catch (err) {
    console.error("Error:", err.message);
  }
}
test();
