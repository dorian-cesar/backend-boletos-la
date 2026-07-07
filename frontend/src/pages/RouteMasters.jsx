import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  Route as RouteIcon, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Loader, 
  AlertCircle,
  CheckCircle2,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  MapPin
} from 'lucide-react';

const RouteMasters = () => {
  const [routes, setRoutes] = useState([]);
  const [filteredRoutes, setFilteredRoutes] = useState([]);
  const [cities, setCities] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [expandedRoute, setExpandedRoute] = useState(null); // id of route to show stops

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null); // null for create, object for edit
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [startTimeStr, setStartTimeStr] = useState('08:00'); // HH:MM
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [layout, setLayout] = useState('');
  
  // Schedule Sub-form
  const [scheduleActive, setScheduleActive] = useState(true);
  const [daysOfWeek, setDaysOfWeek] = useState([1, 2, 3, 4, 5, 6, 7]); // Mon-Sun
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [horizonDays, setHorizonDays] = useState(14);
  
  // Stops Sub-form (array de { city: string, order: number, offsetMinutes: number, price: number })
  const [stops, setStops] = useState([]);

  const daysList = [
    { value: 1, label: 'L' },
    { value: 2, label: 'M' },
    { value: 3, label: 'Mi' },
    { value: 4, label: 'J' },
    { value: 5, label: 'V' },
    { value: 6, label: 'S' },
    { value: 7, label: 'D' },
  ];

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [routesRes, citiesRes, layoutsRes] = await Promise.all([
        api.get('/route-masters'),
        api.get('/cities'),
        api.get('/bus-layout')
      ]);

      const rData = routesRes.data.data || [];
      setRoutes(rData);
      setFilteredRoutes(rData);
      setCities(citiesRes.data.data || []);
      setLayouts(layoutsRes.data.data || []);
    } catch (err) {
      console.error('Error fetching routes data:', err);
      setError(err.response?.data?.message || 'Error al obtener la información de rutas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredRoutes(routes);
    } else {
      const query = search.toLowerCase().trim();
      const filtered = routes.filter(r => 
        r.name.toLowerCase().includes(query) ||
        r.origin?.name?.toLowerCase().includes(query) ||
        r.destination?.name?.toLowerCase().includes(query)
      );
      setFilteredRoutes(filtered);
    }
  }, [search, routes]);

  const handleDeleteRoute = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar permanentemente esta ruta maestra? Se detendrá la generación de servicios asociados.')) return;
    try {
      await api.delete(`/route-masters/${id}`);
      showSuccess('Ruta maestra eliminada.');
      fetchAllData();
    } catch (err) {
      console.error('Error deleting route:', err);
      setError(err.response?.data?.message || 'Error al eliminar la ruta.');
    }
  };

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Convertidores de Tiempo
  const timeToMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const minutesToTime = (mins) => {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const openCreateModal = () => {
    setEditingRoute(null);
    setName('');
    setOrigin(cities.length > 0 ? cities[0]._id : '');
    setDestination(cities.length > 1 ? cities[1]._id : '');
    setStartTimeStr('08:00');
    setDurationMinutes(180);
    setLayout(layouts.length > 0 ? layouts[0]._id : '');
    setScheduleActive(true);
    setDaysOfWeek([1, 2, 3, 4, 5, 6, 7]);
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate('');
    setHorizonDays(14);
    setStops([]);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = async (route) => {
    setEditingRoute(route);
    setLoading(true);
    
    try {
      // Necesitamos obtener la ruta por ID para que vengan populadas las paradas intermadias
      const res = await api.get(`/route-masters/${route._id}`);
      const rDetail = res.data.data;

      setName(rDetail.name);
      setOrigin(rDetail.origin?._id || rDetail.origin || '');
      setDestination(rDetail.destination?._id || rDetail.destination || '');
      setStartTimeStr(minutesToTime(rDetail.startTime));
      setDurationMinutes(rDetail.durationMinutes);
      setLayout(rDetail.layout?._id || rDetail.layout || '');
      
      const sched = rDetail.schedule || {};
      setScheduleActive(sched.active !== false);
      setDaysOfWeek(sched.daysOfWeek || [1, 2, 3, 4, 5, 6, 7]);
      setStartDate(sched.startDate ? sched.startDate.slice(0, 10) : '');
      setEndDate(sched.endDate ? sched.endDate.slice(0, 10) : '');
      setHorizonDays(sched.horizonDays || 14);

      // Mapear paradas para el subformulario
      const mappedStops = (rDetail.stops || []).map(s => ({
        city: s.city?._id || s.city || '',
        order: s.order,
        offsetMinutes: s.offsetMinutes || 0,
        price: s.price || 0
      }));
      setStops(mappedStops.sort((a, b) => a.order - b.order));
      
      setFormError(null);
      setModalOpen(true);
    } catch (err) {
      console.error('Error fetching route details:', err);
      setError('No se pudieron obtener los detalles de la ruta para editar.');
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = (day) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter(d => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort());
    }
  };

  // Gestión de Paradas en Formulario
  const handleAddStop = () => {
    const nextOrder = stops.length > 0 ? Math.max(...stops.map(s => s.order)) + 1 : 1;
    setStops([...stops, {
      city: cities.length > 0 ? cities[0]._id : '',
      order: nextOrder,
      offsetMinutes: 60 * nextOrder,
      price: 1000 * nextOrder
    }]);
  };

  const handleRemoveStop = (idx) => {
    setStops(stops.filter((_, i) => i !== idx));
  };

  const handleStopChange = (idx, field, value) => {
    const updated = [...stops];
    updated[idx] = { ...updated[idx], [field]: value };
    setStops(updated);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (origin === destination) {
      setFormError('El origen y el destino no pueden ser la misma ciudad.');
      return;
    }

    if (daysOfWeek.length === 0) {
      setFormError('Debe seleccionar al menos un día de la semana para la programación.');
      return;
    }

    // Validar paradas duplicadas
    const stopCities = stops.map(s => s.city);
    const uniqueStopCities = new Set(stopCities);
    if (uniqueStopCities.size !== stopCities.length) {
      setFormError('No puede agregar la misma ciudad intermedia más de una vez.');
      return;
    }

    // Validar órdenes únicos en paradas
    const orders = stops.map(s => Number(s.order));
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      setFormError('Cada parada intermedia debe tener un número de orden exclusivo.');
      return;
    }

    setSubmitLoading(true);

    const payload = {
      name: name.trim(),
      origin,
      destination,
      startTime: timeToMinutes(startTimeStr),
      durationMinutes: Number(durationMinutes),
      layout,
      stops: stops.map(s => ({
        city: s.city,
        order: Number(s.order),
        offsetMinutes: Number(s.offsetMinutes),
        price: Number(s.price)
      })),
      schedule: {
        active: scheduleActive,
        daysOfWeek,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        horizonDays: Number(horizonDays)
      }
    };

    try {
      if (editingRoute) {
        await api.put(`/route-masters/${editingRoute._id}`, payload);
        showSuccess('Ruta maestra actualizada correctamente.');
      } else {
        await api.post('/route-masters', payload);
        showSuccess('Ruta maestra creada correctamente.');
      }
      setModalOpen(false);
      fetchAllData();
    } catch (err) {
      console.error('Error saving route:', err);
      setFormError(err.response?.data?.message || 'Error al guardar la ruta maestra.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleExpandRoute = async (routeId) => {
    if (expandedRoute === routeId) {
      setExpandedRoute(null);
      return;
    }
    
    // Buscar si ya tenemos cargadas las paradas en esta ruta localmente
    const localRoute = routes.find(r => r._id === routeId);
    if (localRoute && localRoute.stopsLoaded) {
      setExpandedRoute(routeId);
      return;
    }

    try {
      // Traer detalles completos con paradas populadas
      const res = await api.get(`/route-masters/${routeId}/stops`);
      const stopsDetail = res.data.stops || [];
      
      setRoutes(routes.map(r => {
        if (r._id === routeId) {
          return { ...r, fullStops: stopsDetail, stopsLoaded: true };
        }
        return r;
      }));
      setExpandedRoute(routeId);
    } catch (err) {
      console.error('Error fetching stops:', err);
      setError('No se pudieron obtener las paradas de la ruta.');
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      
      {/* Encabezado y botón Agregar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
            <RouteIcon className="text-indigo-400" size={26} />
            Rutas Maestras
          </h1>
          <p className="text-slate-400 text-sm">Gestiona los itinerarios de viaje fijos, sus precios, paradas intermedias y calendarios.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-600/10 text-sm self-start sm:self-auto transition-all"
        >
          <Plus size={18} />
          Nueva Ruta Maestra
        </button>
      </div>

      {/* Alertas */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-950/20 border border-red-800/50 rounded-xl text-red-200 text-sm">
          <AlertCircle size={20} className="shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 bg-emerald-950/20 border border-emerald-800/50 rounded-xl text-emerald-200 text-sm animate-fade-in">
          <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
        <div className="relative max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre o ciudad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-sm"
          />
        </div>
      </div>

      {/* Tabla de Rutas Maestras */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
        {loading && routes.length === 0 ? (
          <div className="p-12 flex flex-col justify-center items-center gap-3 text-slate-400">
            <Loader className="animate-spin text-indigo-500" size={32} />
            <span>Cargando rutas maestras...</span>
          </div>
        ) : filteredRoutes.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No se encontraron rutas maestras configuradas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-4 px-6">Identificador Ruta</th>
                  <th className="py-4 px-6">Recorrido Principal</th>
                  <th className="py-4 px-6">Salida y Duración</th>
                  <th className="py-4 px-6">Distribución Bus</th>
                  <th className="py-4 px-6 text-center">Frecuencia</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRoutes.flatMap((route) => {
                  const isExpanded = expandedRoute === route._id;
                  return [
                    <tr key={route._id} className="hover:bg-slate-950/10 text-slate-300 text-sm transition-all">
                      <td className="py-4 px-6">
                        <div className="font-semibold text-white">{route.name}</div>
                        <button 
                          onClick={() => handleExpandRoute(route._id)}
                          className="mt-1 flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold focus:outline-none"
                        >
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          <span>{isExpanded ? 'Ocultar Paradas' : 'Ver Paradas'}</span>
                        </button>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{route.origin?.name}</span>
                          <span className="text-slate-500">→</span>
                          <span className="font-semibold text-white">{route.destination?.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Clock size={13} className="text-indigo-400" />
                          <span>Salida: <strong>{minutesToTime(route.startTime)} hrs</strong></span>
                        </div>
                        <div className="text-[11px] text-slate-500 pl-4.5 mt-0.5">
                          Duración: {Math.floor(route.durationMinutes / 60)}h {route.durationMinutes % 60}m
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {route.layout?.name || 'Layout cargado'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          route.schedule?.active 
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/30' 
                            : 'bg-slate-850 text-slate-450 border border-slate-850'
                        }`}>
                          {route.schedule?.active ? 'Programación Activa' : 'Pausada'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditModal(route)}
                            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"
                            title="Editar Itinerario"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteRoute(route._id)}
                            className="p-1.5 hover:bg-red-950/40 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                            title="Eliminar Ruta"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>,
                    isExpanded && (
                      <tr key={`${route._id}-stops`} className="bg-slate-950/30">
                        <td colSpan={6} className="px-8 py-4 border-b border-slate-800">
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <MapPin size={14} className="text-indigo-400" />
                              Paradas de la Ruta y Precios Segmentados
                            </h4>
                            
                            {(!route.fullStops || route.fullStops.length === 0) ? (
                              <p className="text-xs text-slate-500">Esta ruta no tiene paradas intermedias registradas (viaje directo).</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                {route.fullStops.map((stop, sIdx) => (
                                  <div 
                                    key={sIdx} 
                                    className="bg-slate-900 border border-slate-800/60 p-3 rounded-xl flex items-center justify-between text-xs"
                                  >
                                    <div>
                                      <p className="font-semibold text-slate-200 flex items-center gap-1">
                                        <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-indigo-400 font-bold">
                                          {stop.order}
                                        </span>
                                        {stop.name}
                                      </p>
                                      <p className="text-[10px] text-slate-500 mt-1 pl-5">
                                        {stop.isOrigin ? 'Punto de Salida' : 
                                         stop.isDestination ? 'Destino Final' : 
                                         `T+${stop.offsetMinutes} mins`}
                                      </p>
                                    </div>
                                    {!stop.isOrigin && (
                                      <div className="text-right">
                                        <span className="font-mono font-bold text-indigo-400">
                                          ${stop.price?.toLocaleString()}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Ventana de Creación / Edición */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto py-8">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
              <h3 className="text-md font-bold text-white">
                {editingRoute ? 'Modificar Ruta Maestra' : 'Crear Ruta Maestra'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white transition-all">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-6">
              {formError && (
                <div className="flex items-center gap-3 p-3 bg-red-950/20 border border-red-800/50 rounded-xl text-red-200 text-xs">
                  <AlertCircle size={16} className="shrink-0 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Información Básica */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nombre del Itinerario *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Santiago - Talca (Servicio Express Mañana)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Layout del Bus *</label>
                  <select
                    value={layout}
                    required
                    onChange={(e) => setLayout(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 focus:outline-none focus:border-indigo-500 text-sm"
                  >
                    <option value="" disabled>Seleccionar diseño...</option>
                    {layouts.map(l => (
                      <option key={l._id} value={l._id}>{l.name} ({l.capacidad} Asientos)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Ciudad Origen *</label>
                  <select
                    value={origin}
                    required
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 focus:outline-none focus:border-indigo-500 text-sm"
                  >
                    <option value="" disabled>Seleccionar origen...</option>
                    {cities.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Ciudad Destino *</label>
                  <select
                    value={destination}
                    required
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 focus:outline-none focus:border-indigo-500 text-sm"
                  >
                    <option value="" disabled>Seleccionar destino...</option>
                    {cities.map(c => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Hora Salida *</label>
                    <input
                      type="time"
                      required
                      value={startTimeStr}
                      onChange={(e) => setStartTimeStr(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-sm font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Minutos Duración *</label>
                    <input
                      type="number"
                      required
                      min={10}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Subformulario: Programación de Salidas (Schedule) */}
              <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Configuración del Calendario de Programación</h4>
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="scheduleActiveCheck"
                      checked={scheduleActive}
                      onChange={(e) => setScheduleActive(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800"
                    />
                    <label htmlFor="scheduleActiveCheck" className="text-xs font-semibold text-slate-350 select-none cursor-pointer">
                      Generación Automática Activa
                    </label>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  {/* Días de la semana */}
                  <div className="md:col-span-1">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Días de Salida</label>
                    <div className="flex flex-wrap gap-1.5">
                      {daysList.map(d => (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => handleDayToggle(d.value)}
                          className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all border ${
                            daysOfWeek.includes(d.value) 
                              ? 'bg-indigo-600 border-indigo-500 text-white' 
                              : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fechas límites y Horizon days */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Fecha Inicio / Fin de Vigencia</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={startDate}
                        placeholder="Inicio"
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-1/2 px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-300 text-xs"
                      />
                      <input
                        type="date"
                        value={endDate}
                        placeholder="Fin (Opcional)"
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-1/2 px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-slate-300 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2" title="Cantidad de días a generar por adelantado">
                      Horizonte de Días (Horizon Days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={horizonDays}
                      onChange={(e) => setHorizonDays(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-850 rounded-lg text-slate-200 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Subformulario: Paradas Intermedias (Stops) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <MapPin size={15} className="text-indigo-400" />
                    Paradas Intermedias y Precios
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddStop}
                    className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold focus:outline-none"
                  >
                    <Plus size={14} />
                    Añadir Parada Intermedia
                  </button>
                </div>

                {stops.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2 text-center bg-slate-950/20 border border-slate-800/40 rounded-xl">
                    Esta ruta no posee paradas intermedias (viaje directo entre Origen y Destino).
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-2">
                    {stops.map((stop, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                        {/* Selector de Ciudad */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Ciudad Parada</label>
                          <select
                            value={stop.city}
                            onChange={(e) => handleStopChange(idx, 'city', e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-xs"
                          >
                            {cities.map(c => (
                              <option key={c._id} value={c._id}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Orden */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Orden Parada</label>
                          <input
                            type="number"
                            min={1}
                            value={stop.order}
                            onChange={(e) => handleStopChange(idx, 'order', Number(e.target.value))}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs"
                          />
                        </div>

                        {/* Offset minutos */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1" title="Minutos transcurridos desde la salida del origen">
                            Offset Minutos
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={stop.offsetMinutes}
                            onChange={(e) => handleStopChange(idx, 'offsetMinutes', Number(e.target.value))}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs"
                          />
                        </div>

                        {/* Precio y botón de borrar */}
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Precio ($)</label>
                            <input
                              type="number"
                              min={0}
                              value={stop.price}
                              onChange={(e) => handleStopChange(idx, 'price', Number(e.target.value))}
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-250 text-xs font-mono"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveStop(idx)}
                            className="p-2 bg-red-950/20 border border-red-900/30 text-red-400 hover:text-red-300 rounded-lg focus:outline-none transition-all mb-0.5"
                            title="Eliminar parada"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Botones de Acción */}
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-xl text-sm font-semibold transition-all"
                >
                  {submitLoading && <Loader size={16} className="animate-spin" />}
                  <span>{editingRoute ? 'Guardar Cambios' : 'Crear Ruta Maestra'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default RouteMasters;
