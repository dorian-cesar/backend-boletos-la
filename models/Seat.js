// models/Seat.js
const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  origin: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
  destination: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
  originOrder: { type: Number, required: true },
  destinationOrder: { type: Number, required: true },
  status: { type: String, enum: ['reserved', 'confirmed'], required: true },
  holdUntil: { type: Date, default: null }
}, { _id: false });

const seatSchema = new mongoose.Schema({
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  code: { type: String, required: true },
  floor: Number,
  type: String,
  isAvailable: { type: Boolean, default: true },
  holdUntil: { type: Date, default: null },
  status: {
    type: String,
    enum: ['available', 'reserved', 'confirmed'],
    default: 'available'
  },
  passenger: {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    origin: { type: mongoose.Schema.Types.ObjectId, ref: 'City' },
    destination: { type: mongoose.Schema.Types.ObjectId, ref: 'City' },
    boardingStop: String,
    landingStop: String,
    boarded: { type: Boolean, default: false },
    landed: { type: Boolean, default: false }
  },
  reservations: { type: [reservationSchema], default: [] }
}, { timestamps: true });

// Método para reserva temporal
seatSchema.methods.temporaryReserve = async function (userId, originId, destinationId, holdMinutes = 10) {
  this.isAvailable = false;
  this.status = 'reserved';
  this.holdUntil = new Date(Date.now() + holdMinutes * 60 * 1000);
  this.passenger = {
    user: userId,
    origin: originId,
    destination: destinationId,
    boarded: false,
    landed: false
  };
  return await this.save(); // Asegurar que es async/await
};

// Método para confirmar reserva
seatSchema.methods.confirmReservation = function () {
  this.status = 'confirmed';
  this.holdUntil = null; // Eliminar expiración
  return this.save();
};

// Método para liberar asiento
seatSchema.methods.releaseSeat = function () {
  this.isAvailable = true;
  this.status = 'available';
  this.holdUntil = null;
  this.passenger = undefined;
  return this.save();
};

// Método para marcar como abordado
seatSchema.methods.markAsBoarded = function () {
  this.passenger.boarded = true;
  return this.save();
};

// Método para marcar como llegado a destino
seatSchema.methods.markAsLanded = function () {
  this.passenger.landed = true;
  this.isAvailable = true;
  this.status = 'available';
  this.passenger = {
    user: this.passenger.user,
    origin: this.passenger.origin,
    destination: this.passenger.destination,
    boardingStop: this.passenger.boardingStop,
    landingStop: this.passenger.landingStop,
    boarded: true,
    landed: true
  };
  return this.save();
};

// Índice para búsquedas eficientes
seatSchema.index({ service: 1, code: 1 });
seatSchema.index({ holdUntil: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Seat', seatSchema);