import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  Calendar, 
  Plus, 
  X, 
  Loader, 
  AlertCircle,
  CheckCircle2,
  Users,
  Bus,
  FileText,
  DollarSign,
  Briefcase,
  Layers,
  Search,
  Check
} from 'lucide-react';

const Services = () => {
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [crewUsers, setCrewUsers] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Modales
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [farModalOpen, setFarModalOpen] = useState(false);
  
  // Selected Service
  const [selectedService, setSelectedService] = useState(null);

  // States de Formularios
  // 1. Generación
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState(null);

  // 2. Asignación Bus & Tripulación
  const [selectedBusId, setSelectedBusId] = useState('');
  const [selectedConductorId, setSelectedConductorId] = useState('');
  const [selectedAuxiliarId, setSelectedAuxiliarId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState(null);

  // 3. FAR
  const [farFolio, setFarFolio] = useState('');
  const [farAmount, setFarAmount] = useState(0);
  const [farDeliveredTo, setFarDeliveredTo] = useState('');
  const [farLoading, setFarLoading] = useState(false);
  const [farError, setFarError] = useState(null);
  
  // Rendición de Gastos
  const [expenses, setExpenses] = useState([{ description: '', amount: 0 }]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [servicesRes, routesRes, busesRes, crewRes] = await Promise.all([
        api.get('/services'),
        api.get('/route-masters'),
        api.get('/buses'),
        api.get('/users/crew').catch(() => ({ data: { users: [] } }))
      ]);

      const sData = servicesRes.data || [];
      setServices(sData);
      setFilteredServices(sData);
      setRoutes(routesRes.data.data || []);
      setBuses(busesRes.data.data || []);
      setCrewUsers(crewRes.data.users || []);
    } catch (err) {
      console.error('Error fetching services data:', err);
      setError(err.response?.data?.message || 'Error al obtener la lista de servicios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Filtrado local de servicios
  useEffect(() => {
    let result = [...services];
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(s => 
        s.origin.toLowerCase().includes(q) ||
        s.destination.toLowerCase().includes(q) ||
        (s.routeMaster?.name && s.routeMaster.name.toLowerCase().includes(q))
      );
    }

    if (dateFilter) {
      result = result.filter(s => s.date.slice(0, 10) === dateFilter);
    }

    setFilteredServices(result);
  }, [searchQuery, dateFilter, services]);

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // 1. Generación de Servicios
  const handleGenerateServices = async (e) => {
    e.preventDefault();
    setGenError(null);
    setGenLoading(true);

    try {
      if (!selectedRouteId) {
        setGenError('Debe elegir una ruta maestra.');
        setGenLoading(false);
        return;
      }
      const res = await api.post('/services/generate', { routeMasterId: selectedRouteId });
      showSuccess(`Servicios generados: ${res.data.count} viajes programados.`);
      setGenModalOpen(false);
      fetchInitialData();
    } catch (err) {
      console.error(err);
      setGenError(err.response?.data?.error || err.response?.data?.message || 'Error al generar servicios.');
    } finally {
      setGenLoading(false);
    }
  };

  const handleGenerateAllServices = async () => {
    setGenError(null);
    setGenLoading(true);
    try {
      const res = await api.post('/services/generate-all');
      showSuccess(`Generación global completada. Total: ${res.data.totalServices} servicios.`);
      setGenModalOpen(false);
      fetchInitialData();
    } catch (err) {
      console.error(err);
      setGenError(err.response?.data?.error || 'Error en la generación global.');
    } finally {
      setGenLoading(false);
    }
  };

  // 2. Asignación de Recursos
  const openAssignModal = (service) => {
    setSelectedService(service);
    setSelectedBusId(service.bus?._id || service.bus || '');
    
    // Obtener roles actuales del crew
    const conductor = (service.crew || []).find(c => c.role === 'conductor');
    const auxiliar = (service.crew || []).find(c => c.role === 'auxiliar');
    
    setSelectedConductorId(conductor?.user?._id || conductor?.user || '');
    setSelectedAuxiliarId(auxiliar?.user?._id || auxiliar?.user || '');
    setAssignError(null);
    setAssignModalOpen(true);
  };

  const handleAssignResources = async (e) => {
    e.preventDefault();
    setAssignError(null);
    setAssignLoading(true);

    const crew = [];
    if (selectedConductorId) {
      crew.push({ user: selectedConductorId, role: 'conductor' });
    }
    if (selectedAuxiliarId) {
      crew.push({ user: selectedAuxiliarId, role: 'auxiliar' });
    }

    try {
      await api.put(`/services/${selectedService._id}/assign`, {
        bus: selectedBusId || null,
        crew
      });
      showSuccess('Recursos asignados al servicio exitosamente.');
      setAssignModalOpen(false);
      fetchInitialData();
    } catch (err) {
      console.error(err);
      setAssignError(err.response?.data?.message || 'Error al guardar asignación.');
    } finally {
      setAssignLoading(false);
    }
  };

  // 3. FAR
  const openFarModal = (service) => {
    setSelectedService(service);
    
    const far = service.far || {};
    setFarFolio(far.folio || '');
    setFarAmount(far.amount || 0);
    setFarDeliveredTo(far.deliveredTo?._id || far.deliveredTo || '');
    
    // Si ya tiene gastos, cargarlos, de lo contrario inicializar una fila vacía
    if (far.expenses && far.expenses.length > 0) {
      setExpenses(far.expenses);
    } else {
      setExpenses([{ description: '', amount: 0 }]);
    }
    
    setFarError(null);
    setFarModalOpen(true);
  };

  const handleSaveFar = async (e) => {
    e.preventDefault();
    setFarError(null);
    setFarLoading(true);

    if (!farFolio.trim() || farAmount <= 0 || !farDeliveredTo) {
      setFarError('Folio, Monto mayor a 0 y Destinatario son requeridos.');
      setFarLoading(false);
      return;
    }

    try {
      await api.put(`/services/${selectedService._id}/far`, {
        folio: farFolio.trim(),
        amount: Number(farAmount),
        deliveredTo: farDeliveredTo
      });
      showSuccess('FAR registrado y asignado.');
      setFarModalOpen(false);
      fetchInitialData();
    } catch (err) {
      console.error(err);
      setFarError(err.response?.data?.message || 'Error al asignar FAR.');
    } finally {
      setFarLoading(false);
    }
  };

  // Rendición de Gastos
  const handleAddExpenseRow = () => {
    setExpenses([...expenses, { description: '', amount: 0 }]);
  };

  const handleRemoveExpenseRow = (idx) => {
    setExpenses(expenses.filter((_, i) => i !== idx));
  };

  const handleExpenseChange = (idx, field, value) => {
    const updated = [...expenses];
    updated[idx] = { ...updated[idx], [field]: value };
    setExpenses(updated);
  };

  const handleRenderExpenses = async () => {
    setFarError(null);
    setFarLoading(true);

    // Filtrar filas de gastos vacías
    const cleanExpenses = expenses.filter(e => e.description.trim() && e.amount > 0);
    if (cleanExpenses.length === 0) {
      setFarError('Debe ingresar al menos un gasto válido (descripción y monto mayor a 0).');
      setFarLoading(false);
      return;
    }

    const totalExp = cleanExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    if (totalExp > farAmount) {
      setFarError(`Los gastos totales ($${totalExp}) exceden el fondo del FAR asignado ($${farAmount}).`);
      setFarLoading(false);
      return;
    }

    try {
      await api.put(`/services/${selectedService._id}/far/expenses`, {
        expenses: cleanExpenses
      });
      showSuccess('Gastos rendidos y FAR cerrado exitosamente.');
      setFarModalOpen(false);
      fetchInitialData();
    } catch (err) {
      console.error(err);
      setFarError(err.response?.data?.message || 'Error al rendir gastos.');
    } finally {
      setFarLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      
      {/* Encabezado y botón Agregar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
            <Calendar className="text-indigo-400" size={26} />
            Despacho y Servicios
          </h1>
          <p className="text-slate-400 text-sm">Monitorea los viajes diarios, asigna personal y buses, y liquida viáticos de ruta (FAR).</p>
        </div>
        <button
          onClick={() => { setSelectedRouteId(''); setGenError(null); setGenModalOpen(true); }}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-600/10 text-sm self-start sm:self-auto transition-all"
        >
          <Plus size={18} />
          Generar Servicios
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
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 shadow-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Buscar por Ciudad Origen, Destino..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-sm"
          />
        </div>
        <div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 focus:outline-none focus:border-indigo-500 text-sm"
          />
        </div>
      </div>

      {/* Tabla de Servicios */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col justify-center items-center gap-3 text-slate-400">
            <Loader className="animate-spin text-indigo-500" size={32} />
            <span>Cargando servicios activos...</span>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No se encontraron servicios vigentes. Intente generando servicios para los próximos días.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-4 px-6">Servicio / Ruta</th>
                  <th className="py-4 px-6">Fecha y Hora</th>
                  <th className="py-4 px-6">Bus Asignado</th>
                  <th className="py-4 px-6">Tripulación</th>
                  <th className="py-4 px-6">FAR / Viáticos</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredServices.map((service) => {
                  const conductor = (service.crew || []).find(c => c.role === 'conductor');
                  const auxiliar = (service.crew || []).find(c => c.role === 'auxiliar');
                  
                  return (
                    <tr key={service._id} className="hover:bg-slate-950/20 text-slate-300 text-sm transition-all">
                      <td className="py-4 px-6">
                        <p className="font-bold text-white">{service.origin} → {service.destination}</p>
                        <p className="text-xs text-slate-500">Itinerario: {service.routeMaster?.name || 'Desconocido'}</p>
                      </td>
                      <td className="py-4 px-6">
                        <p className="font-semibold text-slate-200">{new Date(service.date).toLocaleDateString()}</p>
                        <p className="text-xs text-indigo-400">Salida Programada</p>
                      </td>
                      <td className="py-4 px-6">
                        {service.bus ? (
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold font-mono px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-900 rounded">
                              {service.bus.patente || 'CON PATENTE'}
                            </span>
                            <p className="text-[11px] text-slate-450 mt-1">{service.bus.marca} {service.bus.modelo}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-500 flex items-center gap-1">
                            <AlertCircle size={14} /> Sin Bus Asignado
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-400 space-y-1">
                        <div className="flex items-center gap-1">
                          <Users size={12} className="text-slate-500" />
                          <span>Chofer: {conductor ? <strong className="text-slate-200">{conductor.user?.name || 'Asignado'}</strong> : <span className="text-amber-500">Pendiente</span>}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users size={12} className="text-slate-500" />
                          <span>Auxiliar: {auxiliar ? <strong className="text-slate-200">{auxiliar.user?.name || 'Asignado'}</strong> : <span className="text-slate-550">Pendiente</span>}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {service.far ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-xs">
                              <FileText size={12} className="text-slate-400" />
                              <span className="font-mono text-slate-300">Folio: {service.far.folio}</span>
                            </div>
                            <div className="text-xs font-bold text-emerald-400">${service.far.amount.toLocaleString()}</div>
                            <span className={`inline-block px-2 py-0.2 text-[10px] font-semibold rounded ${
                              service.far.status === 'pendiente' ? 'bg-amber-950 text-amber-300 border border-amber-800/30' :
                              service.far.status === 'rendido' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/30' :
                              'bg-slate-800 text-slate-400'
                            }`}>
                              {service.far.status}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">Sin FAR</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openAssignModal(service)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-all"
                            title="Asignar Bus y Tripulación"
                          >
                            <Bus size={14} /> Asignar
                          </button>
                          
                          <button
                            onClick={() => openFarModal(service)}
                            disabled={!service.crew || service.crew.length === 0}
                            className="px-2.5 py-1.5 bg-indigo-950/45 hover:bg-indigo-900/60 border border-indigo-900/40 text-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            title="Gestionar Fondos Rendición"
                          >
                            <DollarSign size={14} /> FAR
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 1. MODAL GENERAR SERVICIOS */}
      {genModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
              <h3 className="text-md font-bold text-white">Generar Servicios de Salida</h3>
              <button onClick={() => setGenModalOpen(false)} className="text-slate-400 hover:text-white transition-all">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              {genError && (
                <div className="flex items-center gap-3 p-3 bg-red-950/20 border border-red-800/50 rounded-xl text-red-200 text-xs">
                  <AlertCircle size={16} className="shrink-0 text-red-400" />
                  <span>{genError}</span>
                </div>
              )}

              {/* Botón de Generación Global */}
              <div className="text-center p-4 bg-indigo-950/15 border border-indigo-900/30 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Generación Masiva</h4>
                <p className="text-xs text-slate-400">Genera salidas de forma automática para los próximos 14 días para todas las rutas con horario activo.</p>
                <button
                  type="button"
                  disabled={genLoading}
                  onClick={handleGenerateAllServices}
                  className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-semibold rounded-lg text-xs transition-all shadow-md"
                >
                  {genLoading ? 'Procesando generación...' : 'Ejecutar para todas las rutas activas'}
                </button>
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-4 text-slate-600 text-xs font-bold uppercase">ó por ruta individual</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              {/* Formulario de Generación Individual */}
              <form onSubmit={handleGenerateServices} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Seleccionar Ruta Maestra</label>
                  <select
                    value={selectedRouteId}
                    onChange={(e) => setSelectedRouteId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 focus:outline-none focus:border-indigo-500 text-xs"
                  >
                    <option value="">Seleccione una ruta...</option>
                    {routes.filter(r => r.schedule?.active).map(r => (
                      <option key={r._id} value={r._id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={genLoading}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-white font-semibold rounded-xl text-xs transition-all border border-slate-700"
                >
                  {genLoading ? 'Generando...' : 'Generar para esta ruta'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL ASIGNAR BUS Y TRIPULACIÓN */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
              <div>
                <h3 className="text-md font-bold text-white">Despacho de Itinerario</h3>
                <p className="text-xs text-slate-500">Asigna un bus libre y los tripulantes asignados al viaje.</p>
              </div>
              <button onClick={() => setAssignModalOpen(false)} className="text-slate-400 hover:text-white transition-all">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAssignResources} className="p-6 space-y-4">
              {assignError && (
                <div className="flex items-center gap-3 p-3 bg-red-950/20 border border-red-800/50 rounded-xl text-red-200 text-xs">
                  <AlertCircle size={16} className="shrink-0 text-red-400" />
                  <span>{assignError}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Selección de Bus */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Vehículo / Bus Asignado</label>
                  <select
                    value={selectedBusId}
                    onChange={(e) => setSelectedBusId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 focus:outline-none focus:border-indigo-500 text-sm"
                  >
                    <option value="">-- Sin Bus (Desasignar) --</option>
                    {buses.filter(b => b.disponible).map(b => (
                      <option key={b._id} value={b._id}>
                        {b.patente} - {b.marca} {b.modelo} (Layout: {b.layout?.name || 'OK'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Conductor */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Conductor (Chofer Principal)</label>
                  <select
                    value={selectedConductorId}
                    onChange={(e) => setSelectedConductorId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 focus:outline-none focus:border-indigo-500 text-sm"
                  >
                    <option value="">-- Sin Conductor --</option>
                    {crewUsers.filter(u => u.role === 'conductor' || u.role === 'admin' || u.role === 'superAdmin').map(u => (
                      <option key={u._id} value={u._id}>{u.name} (RUT: {u.rut})</option>
                    ))}
                  </select>
                </div>

                {/* Auxiliar */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Auxiliar de Cabina</label>
                  <select
                    value={selectedAuxiliarId}
                    onChange={(e) => setSelectedAuxiliarId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 focus:outline-none focus:border-indigo-500 text-sm"
                  >
                    <option value="">-- Sin Auxiliar --</option>
                    {crewUsers.filter(u => u.role === 'auxiliar' || u.role === 'usuario').map(u => (
                      <option key={u._id} value={u._id}>{u.name} (RUT: {u.rut})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={assignLoading}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-xl text-sm font-semibold transition-all"
                >
                  {assignLoading && <Loader size={16} className="animate-spin" />}
                  <span>Guardar Asignación</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. MODAL GESTIONAR FAR (FONDOS RENDICIÓN) */}
      {farModalOpen && selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto py-8">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
              <div>
                <h3 className="text-md font-bold text-white">Fondo de Asistencia de Ruta (FAR)</h3>
                <p className="text-xs text-slate-500">Asigna viáticos y liquida los gastos al finalizar el servicio.</p>
              </div>
              <button onClick={() => setFarModalOpen(false)} className="text-slate-400 hover:text-white transition-all">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {farError && (
                <div className="flex items-center gap-3 p-3 bg-red-950/20 border border-red-800/50 rounded-xl text-red-200 text-xs">
                  <AlertCircle size={16} className="shrink-0 text-red-400" />
                  <span>{farError}</span>
                </div>
              )}

              {/* Formulario de Registro / Creación de FAR */}
              {(!selectedService.far || selectedService.far.status === 'pendiente') ? (
                <form onSubmit={handleSaveFar} className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-850">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">
                    {selectedService.far ? 'Actualizar FAR Asignado' : 'Asignar Nuevo FAR (Viático)'}
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Número de Folio *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. F-1004"
                        value={farFolio}
                        onChange={(e) => setFarFolio(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Monto Asignado ($) *</label>
                      <input
                        type="number"
                        required
                        min={100}
                        value={farAmount}
                        onChange={(e) => setFarAmount(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1.5">Entregar a (Tripulante) *</label>
                      <select
                        value={farDeliveredTo}
                        required
                        onChange={(e) => setFarDeliveredTo(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 text-xs"
                      >
                        <option value="" disabled>Elegir del crew...</option>
                        {selectedService.crew?.map(member => (
                          <option key={member.user?._id || member.user} value={member.user?._id || member.user}>
                            {member.user?.name} ({member.role})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="text-right">
                    <button
                      type="submit"
                      disabled={farLoading}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-850 text-white rounded-lg text-xs font-semibold transition-all shadow-md"
                    >
                      {farLoading ? 'Guardando FAR...' : 'Confirmar Asignación FAR'}
                    </button>
                  </div>
                </form>
              ) : (
                /* Detalle de FAR asignado */
                <div className="bg-slate-950/40 p-4 border border-slate-850 rounded-xl space-y-2.5 text-sm text-slate-350">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Detalles del Viático (FAR)</span>
                    <span className="px-2 py-0.5 rounded text-xs bg-emerald-950 text-emerald-300 border border-emerald-800/20 font-bold capitalize">
                      {selectedService.far.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <p>Folio FAR: <strong className="text-white">{selectedService.far.folio}</strong></p>
                    <p>Monto Entregado: <strong className="text-emerald-400 font-mono">${selectedService.far.amount.toLocaleString()}</strong></p>
                    <p>Beneficiario: <strong className="text-slate-200">{selectedService.far.deliveredTo?.name || 'Cargado'}</strong></p>
                    <p>Entregado el: <strong className="text-slate-450">{new Date(selectedService.far.deliveredAt).toLocaleString()}</strong></p>
                  </div>
                </div>
              )}

              {/* Sección Rendición de Gastos (Habilitada si ya tiene FAR registrado) */}
              {selectedService.far && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Rendición y Desglose de Gastos en Ruta</h4>
                    {selectedService.far.status === 'pendiente' && (
                      <button
                        type="button"
                        onClick={handleAddExpenseRow}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold focus:outline-none flex items-center gap-1"
                      >
                        <Plus size={14} /> Añadir Fila de Gasto
                      </button>
                    )}
                  </div>

                  {selectedService.far.status === 'pendiente' ? (
                    /* Editor de Rendición */
                    <div className="space-y-3">
                      {expenses.map((expense, idx) => (
                        <div key={idx} className="flex gap-3 items-center bg-slate-950/20 p-2.5 rounded-lg border border-slate-850">
                          <div className="flex-1">
                            <input
                              type="text"
                              required
                              placeholder="Ej. Peajes Ruta 5 / Combustible"
                              value={expense.description}
                              onChange={(e) => handleExpenseChange(idx, 'description', e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs"
                            />
                          </div>
                          <div className="w-1/3">
                            <input
                              type="number"
                              required
                              min={0}
                              placeholder="Monto"
                              value={expense.amount}
                              onChange={(e) => handleExpenseChange(idx, 'amount', Number(e.target.value))}
                              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono text-emerald-400"
                            />
                          </div>
                          {expenses.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveExpenseRow(idx)}
                              className="p-1.5 bg-red-950/20 border border-red-900/20 text-red-400 hover:text-red-300 rounded"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}

                      <div className="flex justify-between items-center pt-3 text-sm">
                        <span className="text-slate-400">Total Gastos Rendidos:</span>
                        <span className="font-mono font-bold text-indigo-400 text-lg">
                          ${expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0).toLocaleString()}
                        </span>
                      </div>

                      <div className="text-right pt-4 border-t border-slate-850">
                        <button
                          type="button"
                          disabled={farLoading}
                          onClick={handleRenderExpenses}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-850 text-white font-semibold rounded-xl text-xs transition-all shadow-md"
                        >
                          {farLoading ? 'Enviando rendición...' : 'Rendir Fondos y Cerrar FAR'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Visualización de Gastos ya Rendidos */
                    <div className="space-y-3">
                      <div className="bg-slate-950/40 p-4 border border-slate-850 rounded-xl space-y-2">
                        {selectedService.far.expenses?.map((e, idx) => (
                          <div key={idx} className="flex justify-between text-xs py-1 border-b border-slate-900/60 last:border-0 text-slate-350">
                            <span>{e.description}</span>
                            <strong className="font-mono text-slate-200">${e.amount.toLocaleString()}</strong>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex justify-between items-center text-xs text-slate-400 px-2">
                        <span>Rendición procesada el:</span>
                        <span>{new Date(selectedService.far.renderedAt).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center font-bold text-sm bg-slate-950 px-4 py-3 rounded-lg border border-slate-850">
                        <span>Total Gastado:</span>
                        <span className="font-mono text-emerald-400 text-md">
                          ${selectedService.far.expenses?.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-800 text-right bg-slate-950/20">
              <button
                onClick={() => setFarModalOpen(false)}
                className="px-5 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-all border border-slate-800"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Services;
