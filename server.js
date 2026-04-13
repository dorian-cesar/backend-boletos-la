require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

//crons
const startReleaseSeatsCron = require("./cron/releaseSeats.cron");
const startGenerateServicesCron = require("./cron/generateServices.cron");

//server
const routes = require("./routes/index.routes");
const app = express();

//middlewares
app.use(cors());
app.use(express.json());

//rutas
app.use("/api", routes);

app.get("/api/test", (req, res) => {
  res.json({
    status: "OK",
    message: "Backend funcionando",
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

const PORT = process.env.PORT;
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Conectado a DB");
    startReleaseSeatsCron();

    if (process.env.NODE_ENV === "production") {
      startGenerateServicesCron();
    }

    app.listen(PORT, () => {
      process.env.NODE_ENV === "production"
        ? console.log(`Servidor en puerto: ${PORT}`)
        : console.log(`Servidor en desarrollo en http://localhost:${PORT}`);
    });
  })
  .catch((err) => console.error("Error en conexión a DB:", err));
