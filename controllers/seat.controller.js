// controllers/seat.controller.js
const Seat = require('../models/Seat');
const User = require('../models/User');
const Service = require('../models/Service');
const City = require('../models/City');

// RESERVAR asiento (hold temporal segmentado)
async function reserveSeat(req, res) {
  try {
    const { serviceId, seatCode, rut, originCityId, destinationCityId } = req.body;

    if (!serviceId || !seatCode || !rut || !originCityId || !destinationCityId) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    // Validar usuario
    const user = await User.findOne({ rut });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Validar servicio y ciudades
    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ message: 'Servicio no encontrado' });

    const originCity = await City.findById(originCityId);
    const destinationCity = await City.findById(destinationCityId);
    if (!originCity || !destinationCity) {
      return res.status(404).json({ message: 'Ciudad de origen o destino no encontrada' });
    }

    // Validar que las paradas existen en el servicio
    const originStop = service.departures.find(d => d.stop === originCity.name);
    const destinationStop = service.departures.find(d => d.stop === destinationCity.name);

    if (!originStop || !destinationStop) {
      return res.status(400).json({ message: 'Las ciudades seleccionadas no existen en este servicio' });
    }

    const originOrder = originStop.order;
    const destOrder = destinationStop.order;

    if (originOrder >= destOrder) {
      return res.status(400).json({ message: 'La ciudad de destino debe estar después de la ciudad de origen' });
    }

    // Buscar asiento específico
    const seat = await Seat.findOne({
      service: serviceId,
      code: seatCode
    });

    if (!seat) {
      return res.status(404).json({ message: 'Asiento no encontrado' });
    }

    // Comprobar solapamiento con reservas activas
    const now = new Date();
    const activeOverlapping = (seat.reservations || []).find(r => {
      const isActive = r.status === 'confirmed' || (r.status === 'reserved' && r.holdUntil && r.holdUntil > now);
      if (!isActive) return false;
      // Condición de solapamiento de intervalos
      return originOrder < r.destinationOrder && r.originOrder < destOrder;
    });

    if (activeOverlapping) {
      return res.status(400).json({
        message: 'El asiento no está disponible para el tramo solicitado',
        details: {
          overlapStatus: activeOverlapping.status,
          overlapOrigin: activeOverlapping.origin,
          overlapDestination: activeOverlapping.destination
        }
      });
    }

    // Limpiar reservas expiradas
    seat.reservations = (seat.reservations || []).filter(r => {
      return r.status === 'confirmed' || (r.status === 'reserved' && r.holdUntil && r.holdUntil > now);
    });

    // Agregar nueva reserva temporal (10 minutos)
    const holdUntil = new Date(Date.now() + 10 * 60 * 1000);
    const newReservation = {
      user: user._id,
      origin: originCityId,
      destination: destinationCityId,
      originOrder,
      destinationOrder: destOrder,
      status: 'reserved',
      holdUntil
    };

    seat.reservations.push(newReservation);

    // Sincronizar campos legacy por compatibilidad
    seat.status = 'reserved';
    seat.isAvailable = false;
    seat.holdUntil = holdUntil;
    seat.passenger = {
      user: user._id,
      origin: originCityId,
      destination: destinationCityId,
      boardingStop: originCity.name,
      landingStop: destinationCity.name
    };

    await seat.save();

    const populatedSeat = await Seat.findById(seat._id)
      .populate('passenger.user', 'name rut email')
      .populate('passenger.origin', 'name code')
      .populate('passenger.destination', 'name code')
      .populate('reservations.user', 'name rut email')
      .populate('reservations.origin', 'name code')
      .populate('reservations.destination', 'name code');

    res.status(201).json({
      message: `Asiento ${seat.code} reservado temporalmente desde ${originCity.name} hasta ${destinationCity.name}`,
      seat: populatedSeat,
      holdUntil: seat.holdUntil
    });

  } catch (err) {
    console.error('[ERROR] Error en reserveSeat:', err);
    res.status(500).json({ message: 'Error al reservar asiento', error: err.message });
  }
}

// CONFIRMAR asiento (hold -> ocupado hasta destino)
async function confirmSeat(req, res) {
  try {
    const { serviceId, seatCode, rut } = req.body;

    if (!serviceId || !seatCode) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    const seat = await Seat.findOne({
      service: serviceId,
      code: seatCode
    });

    if (!seat) {
      return res.status(404).json({ message: 'Asiento no encontrado' });
    }

    const now = new Date();
    let reservationIndex = -1;

    if (rut) {
      const user = await User.findOne({ rut });
      if (user) {
        reservationIndex = (seat.reservations || []).findIndex(r => 
          String(r.user) === String(user._id) && 
          r.status === 'reserved' && 
          (!r.holdUntil || r.holdUntil > now)
        );
      }
    }

    // Si no se encuentra con RUT, buscamos la primera reserva activa genérica
    if (reservationIndex === -1) {
      reservationIndex = (seat.reservations || []).findIndex(r => 
        r.status === 'reserved' && 
        (!r.holdUntil || r.holdUntil > now)
      );
    }

    if (reservationIndex === -1) {
      return res.status(400).json({ message: 'Reserva no encontrada o ha expirado' });
    }

    const reservation = seat.reservations[reservationIndex];
    reservation.status = 'confirmed';
    reservation.holdUntil = null;

    // Sincronizar campos legacy por compatibilidad
    seat.status = 'confirmed';
    seat.isAvailable = false;
    seat.holdUntil = null;
    seat.passenger = {
      user: reservation.user,
      origin: reservation.origin,
      destination: reservation.destination
    };

    await seat.save();

    const populatedSeat = await Seat.findById(seat._id)
      .populate('passenger.user', 'name rut email')
      .populate('passenger.origin', 'name code')
      .populate('passenger.destination', 'name code')
      .populate('reservations.user', 'name rut email')
      .populate('reservations.origin', 'name code')
      .populate('reservations.destination', 'name code');

    res.json({
      message: `Asiento ${seat.code} confirmado exitosamente`,
      seat: populatedSeat
    });

  } catch (err) {
    console.error('Error en confirmSeat:', err);
    res.status(500).json({ message: 'Error al confirmar asiento', error: err.message });
  }
}

// LIBERAR asiento
async function releaseSeat(req, res) {
  try {
    const { serviceId, seatCode, rut } = req.body;

    if (!serviceId || !seatCode) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    const seat = await Seat.findOne({
      service: serviceId,
      code: seatCode
    });

    if (!seat) {
      return res.status(404).json({ message: 'Asiento no encontrado' });
    }

    let reservationIndex = -1;

    if (rut) {
      const user = await User.findOne({ rut });
      if (user) {
        reservationIndex = (seat.reservations || []).findIndex(r => String(r.user) === String(user._id));
      }
    }

    // Si no hay RUT o no se encuentra, liberar la primera reserva activa
    if (reservationIndex === -1) {
      reservationIndex = (seat.reservations || []).findIndex(r => r.status === 'reserved' || r.status === 'confirmed');
    }

    if (reservationIndex === -1) {
      return res.status(400).json({ message: 'El asiento no posee ninguna reserva activa' });
    }

    seat.reservations.splice(reservationIndex, 1);

    // Recalcular campo legacy con la siguiente reserva más reciente activa si es que queda alguna
    const now = new Date();
    const nextActive = (seat.reservations || []).find(r => 
      r.status === 'confirmed' || (r.status === 'reserved' && r.holdUntil && r.holdUntil > now)
    );

    if (nextActive) {
      seat.status = nextActive.status;
      seat.isAvailable = false;
      seat.holdUntil = nextActive.holdUntil;
      seat.passenger = {
        user: nextActive.user,
        origin: nextActive.origin,
        destination: nextActive.destination
      };
    } else {
      seat.status = 'available';
      seat.isAvailable = true;
      seat.holdUntil = null;
      seat.passenger = undefined;
    }

    await seat.save();

    res.json({
      message: `Asiento ${seat.code} liberado exitosamente`,
      seat: {
        _id: seat._id,
        code: seat.code,
        service: seat.service,
        status: seat.status,
        isAvailable: seat.isAvailable
      }
    });

  } catch (err) {
    console.error('Error en releaseSeat:', err);
    res.status(500).json({ message: 'Error al liberar asiento', error: err.message });
  }
}

// OBTENER asientos de un servicio
async function getServiceSeats(req, res) {
  try {
    const { serviceId } = req.params;
    const { origin, destination } = req.query; // Opcional tramo

    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ message: 'Servicio no encontrado' });

    let originOrder = null;
    let destOrder = null;
    if (origin && destination) {
      const depOrigin = service.departures.find(d => d.stop === origin);
      const depDest = service.departures.find(d => d.stop === destination);
      if (depOrigin && depDest) {
        originOrder = depOrigin.order;
        destOrder = depDest.order;
      }
    }

    const seats = await Seat.find({ service: serviceId })
      .populate('passenger.user', 'name rut email')
      .populate('passenger.origin', 'name code')
      .populate('passenger.destination', 'name code')
      .populate('reservations.user', 'name rut email')
      .populate('reservations.origin', 'name code')
      .populate('reservations.destination', 'name code')
      .select('-__v -createdAt -updatedAt');

    // Mapear tramos dinámicamente si se consultan
    const processedSeats = seats.map(seatDoc => {
      const seat = seatDoc.toObject();
      if (originOrder !== null && destOrder !== null) {
        const now = new Date();
        const activeReservation = seat.reservations.find(r => {
          const isActive = r.status === 'confirmed' || (r.status === 'reserved' && r.holdUntil && new Date(r.holdUntil) > now);
          if (!isActive) return false;
          return originOrder < r.destinationOrder && r.originOrder < destOrder;
        });

        if (activeReservation) {
          seat.status = activeReservation.status;
          seat.isAvailable = false;
          seat.holdUntil = activeReservation.holdUntil;
          seat.passenger = {
            user: activeReservation.user,
            origin: activeReservation.origin,
            destination: activeReservation.destination
          };
        } else {
          seat.status = 'available';
          seat.isAvailable = true;
          seat.holdUntil = null;
          seat.passenger = null;
        }
      }
      return seat;
    });

    res.json({
      serviceId,
      count: processedSeats.length,
      seats: processedSeats
    });

  } catch (err) {
    console.error('Error en getServiceSeats:', err);
    res.status(500).json({ message: 'Error al obtener asientos', error: err.message });
  }
}

module.exports = {
  reserveSeat,
  confirmSeat,
  releaseSeat,
  getServiceSeats
};