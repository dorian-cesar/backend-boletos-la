const mongoose = require('mongoose');
const Service = require('../models/Service');
const RouteMaster = require('../models/RouteMaster');
const Bus = require('../models/Bus');
const User = require('../models/User');
const { generateServicesForRoute } = require('../utils/serviceGenerator');
const { buildSeatMap } = require('../utils/buildSeatMap');

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const tz = require('dayjs/plugin/timezone');
const Seat = require('../models/Seat');
dayjs.extend(utc);
dayjs.extend(tz);
const TZ = 'America/Santiago';

const VALID_ROLES = ['conductor', 'auxiliar'];

exports.generateServices = async (req, res) => {
  try {
    const { routeMasterId } = req.body;

    // HACER POPULATE DE origin, destination Y stops.city
    const route = await RouteMaster.findById(routeMasterId)
      .populate('layout')
      .populate('origin')  // ← AGREGAR ESTO
      .populate('destination')  // ← AGREGAR ESTO
      .populate('stops.city');  // ← AGREGAR ESTO

    if (!route) return res.status(404).json({ error: 'Ruta maestra no encontrada' });

    // Verificar si el horario está activo
    if (!route.schedule.active) {
      return res.status(400).json({ error: 'El horario de esta ruta no está activo' });
    }

    const services = await generateServicesForRoute(route);

    res.status(201).json({
      message: 'Servicios generados',
      count: services.length,
      services
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.generateServicesForAllActiveRoutes = async (req, res) => {
  try {
    const activeRoutes = await RouteMaster.find({
      'schedule.active': true
    }).populate('layout');

    let totalServices = 0;
    const results = [];

    for (const route of activeRoutes) {
      try {
        const services = await generateServicesForRoute(route);
        totalServices += services.length;
        results.push({
          route: route.name,
          servicesCount: services.length,
          status: 'success'
        });
      } catch (error) {
        results.push({
          route: route.name,
          servicesCount: 0,
          status: 'error',
          error: error.message
        });
      }
    }

    res.status(201).json({
      message: 'Generación de servicios completada',
      totalServices,
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getServices = async (req, res) => {
  try {
    const services = await Service.find().populate({ path: 'routeMaster', select: '-layout -createdAt -updatedAt -__v' }).populate({ path: 'layout', select: '-floor1 -floor2 -createdAt -updatedAt -__v' });
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getServicesByFilter = async (req, res) => {
  try {
    const { date, origin, destination } = req.query;

    if (!date || !origin || !destination) {
      return res.status(400).json({ message: 'Faltan parámetros obligatorios' });
    }

    const start = dayjs.tz(date, TZ).startOf('day').toDate();
    const end = dayjs.tz(date, TZ).endOf('day').toDate();

    // Traer servicios que tengan ambas paradas (SIN direction)
    const servicesRaw = await Service.find({
      date: { $gte: start, $lte: end },
      departures: {
        $all: [
          { $elemMatch: { stop: origin } },
          { $elemMatch: { stop: destination } }
        ]
      }
    })
      .populate('layout')
      .populate('bus')
      .populate('crew.user')
      .populate('seats')
      .lean();

    // Filtrar por orden de paradas
    const servicesFiltered = servicesRaw.filter(service => {
      const depOrigin = service.departures.find(d => d.stop === origin);
      const depDest = service.departures.find(d => d.stop === destination);
      return depOrigin && depDest && depOrigin.order < depDest.order;
    });

    // Procesar disponibilidad de asientos por tramo
    for (const service of servicesFiltered) {
      const depOrigin = service.departures.find(d => d.stop === origin);
      const depDest = service.departures.find(d => d.stop === destination);
      if (depOrigin && depDest) {
        const originOrder = depOrigin.order;
        const destOrder = depDest.order;
        const now = new Date();

        service.seats = service.seats.map(seatDoc => {
          const seat = seatDoc.toObject ? seatDoc.toObject() : seatDoc;
          if (seat.reservations && seat.reservations.length > 0) {
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
      }
    }

    return res.status(200).json({ services: servicesFiltered });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al buscar servicios' });
  }
};


exports.getServicesByID = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID inválido' });

    const service = await Service.findById(id)
      // .populate('routeMaster', '-stops -layout -createdAt -updatedAt -__v')
      .populate({
        path: 'layout',
        select: '-__v -createdAt -updatedAt'
      })
      .populate({
        path: 'seats',
        select: '-__v -createdAt -updatedAt'
      })
      .populate({
        path: 'bus',
        select: '-__v -createdAt -updatedAt'
      })
      .populate({
        path: 'crew.user',
        select: '-password -__v -createdAt -updatedAt'
      })
      .select('-__v -createdAt -updatedAt');

    if (!service) return res.status(404).json({ message: 'servicio no encontrado' });

    const departuresSorted = (service.departures || [])
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const departuresForClient = departuresSorted.map(d => {
      const timeIso = d.time instanceof Date ? d.time.toISOString() : d.time;
      let timeLocal = null;
      try {
        timeLocal = dayjs(d.time).tz(TZ).format('HH:mm');
      } catch (e) {
        timeLocal = null;
      }
      return {
        order: d.order,
        stop: d.stop,
        price: d.price,
        time: timeIso,
        timeLocal
      };
    });

    const { origin, destination } = req.query;
    const serviceObj = service.toObject();
    serviceObj.departures = departuresForClient;

    // reemplazamos layout.seatMap con los asientos reales con filtros de tramo
    serviceObj.layout = buildSeatMap(serviceObj, origin, destination);

    delete serviceObj.seats;

    return res.status(200).json({ service: serviceObj });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Error interno' });
  }
};


exports.assignBusAndCrew = async (req, res) => {
  try {
    const { id } = req.params;
    const { bus, crew } = req.body;

    // Validar id del service
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de servicio inválido' });
    }

    if (!bus && !crew) {
      return res.status(400).json({ message: 'Debes enviar al menos "bus" o "crew" en el body' });
    }

    const update = {};

    // Si viene bus: validar formato y existencia
    if (bus) {
      if (!mongoose.Types.ObjectId.isValid(bus)) {
        return res.status(400).json({ message: 'ID de bus inválido' });
      }
      const busExists = await Bus.exists({ _id: bus });
      if (!busExists) return res.status(404).json({ message: 'Bus no encontrado' });
      update.bus = bus;
    }

    // Si viene crew: validar estructura y existencia de usuarios + roles válidos
    if (crew) {
      if (!Array.isArray(crew)) {
        return res.status(400).json({ message: 'Crew debe ser un array' });
      }

      // Validar cada miembro
      const userIds = [];
      for (const [i, member] of crew.entries()) {
        if (!member || !member.user || !member.role) {
          return res.status(400).json({ message: `Crew[${i}] debe tener 'user' y 'role'` });
        }
        if (!mongoose.Types.ObjectId.isValid(member.user)) {
          return res.status(400).json({ message: `Crew[${i}].user tiene ID inválido` });
        }
        if (!VALID_ROLES.includes(member.role)) {
          return res.status(400).json({ message: `Crew[${i}].role inválido (permitidos: ${VALID_ROLES.join(', ')})` });
        }
        userIds.push(member.user);
      }

      // Comprobar que todos los usuarios existen
      const usersCount = await User.countDocuments({ _id: { $in: userIds } });
      if (usersCount !== userIds.length) {
        return res.status(404).json({ message: 'Alguno de los usuarios del crew no existe' });
      }

      update.crew = crew;
    }

    // Actualizar y devolver documento poblado
    const updated = await Service.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    )
      .populate('layout')
      .populate({
        path: 'bus',
        select: '-__v -createdAt -updatedAt'
      })
      .populate({
        path: 'crew.user',
        select: '-password -__v -createdAt -updatedAt'
      });

    if (!updated) return res.status(404).json({ message: 'Servicio no encontrado' });

    return res.status(200).json({ message: 'Asignación realizada', service: updated });
  } catch (err) {
    console.error('assignBusAndCrew error:', err);
    return res.status(500).json({ message: 'Error interno', error: err.message });
  }
};


//asignar far
exports.assignFar = async (req, res) => {
  try {
    const { id } = req.params;
    const { folio, amount, deliveredTo } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'ID de servicio inválido' });
    if (!folio || typeof folio !== 'string') return res.status(400).json({ message: 'folio requerido' });
    if (amount == null || isNaN(Number(amount)) || Number(amount) < 0) return res.status(400).json({ message: 'amount inválido' });
    if (!deliveredTo || !mongoose.Types.ObjectId.isValid(deliveredTo)) return res.status(400).json({ message: 'deliveredTo inválido' });

    // comprobar que user existe
    const userExists = await User.exists({ _id: deliveredTo });
    if (!userExists) return res.status(404).json({ message: 'Usuario entregado no existe' });

    // actualizar usando $set (y crear far si no existe)
    const update = {
      'far.folio': folio,
      'far.amount': Number(amount),
      'far.deliveredTo': deliveredTo,
      'far.deliveredAt': new Date(),
      'far.status': 'pendiente',
      'far.renderedAt': null,
      'far.expenses': []
    };

    // Intentar actualizar; podría fallar por folio duplicado
    const updated = await Service.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true })
      .populate('crew.user', '-password -__v -createdAt -updatedAt')
      .populate('far.deliveredTo', '-password -__v -createdAt -updatedAt')
      .select('-__v -createdAt -updatedAt');

    if (!updated) return res.status(404).json({ message: 'Servicio no encontrado' });

    return res.status(200).json({ message: 'FAR asignado', service: updated });
  } catch (err) {
    // detectar error duplicate key
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'Folio FAR ya existe' });
    }
    console.error(err);
    return res.status(500).json({ message: 'Error interno', error: err.message });
  }
};

exports.addFarExpenses = async (req, res) => {
  try {
    const { id } = req.params;
    const { expenses } = req.body; // array de {description, amount}

    if (!Array.isArray(expenses) || expenses.length === 0) {
      return res.status(400).json({ message: 'Debe enviar un array de expenses' });
    }

    const service = await Service.findById(id);
    if (!service || !service.far) {
      return res.status(404).json({ message: 'Servicio o FAR no encontrado' });
    }

    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    if (totalExpenses > service.far.amount) {
      return res.status(400).json({ message: 'Los gastos exceden el monto del FAR' });
    }

    // actualizar FAR
    service.far.expenses = expenses;
    service.far.renderedAt = new Date();
    service.far.status = 'rendido';

    await service.save();

    return res.status(200).json({ message: 'Gastos registrados', far: service.far });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error interno', error: err.message });
  }
};

exports.getAvailableDestinations = async (req, res) => {
  try {
    const { date, origin } = req.query;

    if (!date || !origin) {
      return res.status(400).json({ message: 'Faltan parámetros obligatorios: date y origin' });
    }

    const start = dayjs.tz(date, TZ).startOf('day').toDate();
    const end = dayjs.tz(date, TZ).endOf('day').toDate();

    // Encontrar servicios para ese día que pasen por el origen
    const services = await Service.find({
      date: { $gte: start, $lte: end },
      departures: { $elemMatch: { stop: origin } }
    }).lean();

    const destinationsSet = new Set();

    services.forEach(service => {
      const originStop = service.departures.find(d => d.stop === origin);
      if (originStop) {
        // Solo son válidos los destinos que están DESPUÉS del origen en el recorrido
        service.departures.forEach(dep => {
          if (dep.order > originStop.order) {
            destinationsSet.add(dep.stop);
          }
        });
      }
    });

    const destinations = Array.from(destinationsSet).sort();

    return res.status(200).json({ 
      success: true, 
      count: destinations.length, 
      destinations 
    });

  } catch (err) {
    console.error('getAvailableDestinations error', err);
    return res.status(500).json({ success: false, message: 'Error interno', error: err.message });
  }
};
