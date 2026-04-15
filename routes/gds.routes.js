/**
 * GDS Routes
 *
 * Todos los endpoints del GDS bajo /api/gds
 *
 * Estructura: /api/gds/:provider/operacion
 * Ejemplo:    /api/gds/delta/search?originId=1&destinationId=5&date=2026-04-15
 *
 * Si en el futuro agregás otro proveedor (ej: 'otro'), el frontend solo
 * cambia :provider en la URL y el backend despacha automáticamente.
 */

const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/gds.controller");
const auth = require("../middlewares/auth.middleware");

// Listar proveedores disponibles (público)
router.get("/providers", ctrl.listProviders);

// ─── Catálogos (requieren auth básica) ────────────────────────────────────────
router.get("/:provider/stops", auth(), ctrl.getStops);
router.get("/:provider/countries", auth(), ctrl.getCountries);
router.get("/:provider/doc-types", auth(), ctrl.getDocTypes);

// ─── Búsqueda ──────────────────────────────────────────────────────────────────
router.get("/:provider/search", auth(), ctrl.search);

// ─── Disponibilidad y tarifas ──────────────────────────────────────────────────
router.get("/:provider/availability", auth(), ctrl.availability);
router.get("/:provider/fares", auth(), ctrl.fares);

// ─── Bloqueo de butacas ────────────────────────────────────────────────────────
router.post("/:provider/connection", auth(), ctrl.generateConnection);
router.post("/:provider/block", auth(), ctrl.block);
router.post("/:provider/unblock", auth(), ctrl.unblock);

// ─── Pasajeros ─────────────────────────────────────────────────────────────────
router.post("/:provider/createPassenger", auth(), ctrl.createPassenger);
router.post("/:provider/findPassenger", auth(), ctrl.findPassenger);

// ─── Venta ─────────────────────────────────────────────────────────────────────
router.post("/:provider/sell", auth(), ctrl.sell);

// ─── Consulta de boleto ────────────────────────────────────────────────────────
router.get("/:provider/tickets/:ticketNumber", auth(), ctrl.queryTicket);
router.get("/:provider/tickets/:ticketNumber/qr", auth(), ctrl.queryTicketQR);

// ─── Recorrido del servicio ────────────────────────────────────────────────────
router.get(
  "/:provider/services/:serviceId/route",
  auth(),
  ctrl.getServiceRoute,
);

module.exports = router;
