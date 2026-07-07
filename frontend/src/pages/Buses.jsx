import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  Bus as BusIcon, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Loader, 
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers
} from 'lucide-react';

const Buses = () => {
  const [buses, setBuses] = useState([]);
  const [filteredBuses, setFilteredBuses] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filtros
  const [search, setSearch] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBus, setEditingBus] = useState(null); // null for create, object for edit
  const [formData, setFormData] = useState({
    patente: '',
    marca: '',
    modelo: '',
    anio: new Date().getFullYear(),
    revision_tecnica: '',
    permiso_circulacion: '',
    disponible: true,
    layout: ''
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchBusesAndLayouts = async () => {
    try {
      setLoading(true);
      setError(null);

      const [busesRes, layoutsRes] = await Promise.all([
        api.get('/buses'),
        api.get('/bus-layout')
      ]);

      const busData = busesRes.data.data || [];
      setBuses(busData);
      setFilteredBuses(busData);
      setLayouts(layoutsRes.data.data || []);
    } catch (err) {
      console.error('Error fetching buses or layouts:', err);
      setError(err.response?.data?.message || 'Error al obtener los datos de buses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusesAndLayouts();
  }, []);

  // Filtrar localmente cuando cambia la búsqueda o la lista completa de buses
  useEffect(() => {
    if (!search.trim()) {
      setFilteredBuses(buses);
    } else {
      const query = search.toLowerCase().trim();
      const filtered = buses.filter(bus => 
        bus.patente.toLowerCase().includes(query) || 
        bus.marca.toLowerCase().includes(query) ||
        bus.modelo.toLowerCase().includes(query)
      );
      setFilteredBuses(filtered);
    }
  }, [search, buses]);

  const handleDeleteBus = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar permanentemente este bus?')) return;
    try {
      await api.delete(`/buses/${id}`);
      showSuccess('Bus eliminado exitosamente.');
      fetchBusesAndLayouts();
    } catch (err) {
      console.error('Error deleting bus:', err);
      setError(err.response?.data?.message || 'Error al eliminar el bus.');
    }
  };

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const openCreateModal = () => {
    setEditingBus(null);
    setFormData({
      patente: '',
      marca: '',
      modelo: '',
      anio: new Date().getFullYear(),
      revision_tecnica: '',
      permiso_circulacion: '',
      disponible: true,
      layout: layouts.length > 0 ? layouts[0]._id : ''
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (bus) => {
    setEditingBus(bus);
    
    // Formatear fechas ISO (YYYY-MM-DDT00:00:00.000Z) a YYYY-MM-DD para el input tipo date
    const formatDate = (isoString) => {
      if (!isoString) return '';
      return isoString.slice(0, 10);
    };

    setFormData({
      patente: bus.patente,
      marca: bus.marca,
      modelo: bus.modelo,
      anio: bus.anio,
      revision_tecnica: formatDate(bus.revision_tecnica),
      permiso_circulacion: formatDate(bus.permiso_circulacion),
      disponible: bus.disponible,
      layout: bus.layout?._id || bus.layout || ''
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Validar patente y campos
    if (!formData.patente.trim() || !formData.marca.trim() || !formData.modelo.trim() || !formData.layout) {
      setFormError('Todos los campos con asterisco (*) son obligatorios.');
      return;
    }

    setSubmitLoading(true);

    try {
      if (editingBus) {
        await api.put(`/buses/${editingBus._id}`, formData);
        showSuccess('Bus actualizado correctamente.');
      } else {
        await api.post('/buses', formData);
        showSuccess('Bus creado exitosamente.');
      }
      setModalOpen(false);
      fetchBusesAndLayouts();
    } catch (err) {
      console.error('Error saving bus:', err);
      setFormError(err.response?.data?.message || 'Error al guardar la información del bus.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      
      {/* Encabezado y botón Agregar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
            <BusIcon className="text-indigo-400" size={26} />
            Control de Buses
          </h1>
          <p className="text-slate-400 text-sm">Gestiona la flota de vehículos, vigencia de permisos y asignación de layouts.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-600/10 text-sm self-start sm:self-auto transition-all"
        >
          <Plus size={18} />
          Registrar Bus
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
            placeholder="Buscar por Patente, Marca, Modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-sm"
          />
        </div>
      </div>

      {/* Tabla de Buses */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col justify-center items-center gap-3 text-slate-400">
            <Loader className="animate-spin text-indigo-500" size={32} />
            <span>Cargando flota de buses...</span>
          </div>
        ) : filteredBuses.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No se encontraron vehículos registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-4 px-6">Identificación / Patente</th>
                  <th className="py-4 px-6">Detalles del Vehículo</th>
                  <th className="py-4 px-6">Diseño Asignado (Layout)</th>
                  <th className="py-4 px-6">Vencimiento Documentación</th>
                  <th className="py-4 px-6 text-center">Estado</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredBuses.map((bus) => (
                  <tr key={bus._id} className="hover:bg-slate-950/20 text-slate-300 text-sm transition-all">
                    <td className="py-4 px-6 font-mono text-indigo-400 font-bold uppercase tracking-wider text-md">
                      {bus.patente}
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-semibold text-white">{bus.marca} {bus.modelo}</p>
                      <p className="text-xs text-slate-500">Año: {bus.anio}</p>
                    </td>
                    <td className="py-4 px-6">
                      {bus.layout ? (
                        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300 bg-indigo-950/40 px-2.5 py-1.5 rounded-lg border border-indigo-900/40 inline-flex">
                          <Layers size={14} />
                          <span>{bus.layout.name || 'Layout cargado'}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-red-400">Sin diseño asignado</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-400 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-500" />
                        <span>Rev. Técnica: <strong>{new Date(bus.revision_tecnica).toLocaleDateString()}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-500" />
                        <span>Perm. Circulac: <strong>{new Date(bus.permiso_circulacion).toLocaleDateString()}</strong></span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        bus.disponible 
                          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/30' 
                          : 'bg-red-950/60 text-red-300 border border-red-800/30'
                      }`}>
                        {bus.disponible ? 'Disponible' : 'Taller / Inactivo'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(bus)}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteBus(bus._id)}
                          className="p-1.5 hover:bg-red-950/40 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Ventana de Creación / Edición */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
              <h3 className="text-md font-bold text-white">
                {editingBus ? 'Modificar Datos de Bus' : 'Registrar Bus'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white transition-all">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="flex items-center gap-3 p-3 bg-red-950/20 border border-red-800/50 rounded-xl text-red-200 text-xs">
                  <AlertCircle size={16} className="shrink-0 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Patente */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Patente (Patente) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. ABCD-12 o ABC-123"
                    value={formData.patente}
                    onChange={(e) => setFormData({ ...formData, patente: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-sm font-bold tracking-widest uppercase"
                  />
                </div>

                {/* Año */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Año *</label>
                  <input
                    type="number"
                    required
                    min={1990}
                    max={new Date().getFullYear() + 1}
                    value={formData.anio}
                    onChange={(e) => setFormData({ ...formData, anio: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                {/* Marca */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Marca *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Mercedes-Benz"
                    value={formData.marca}
                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                {/* Modelo */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Modelo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. O500"
                    value={formData.modelo}
                    onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                {/* Layout Template */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Diseño de Asientos (Layout) *</label>
                  <select
                    value={formData.layout}
                    required
                    onChange={(e) => setFormData({ ...formData, layout: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 focus:outline-none focus:border-indigo-500 text-sm"
                  >
                    <option value="" disabled>Seleccione una plantilla...</option>
                    {layouts.map(l => (
                      <option key={l._id} value={l._id}>
                        {l.name} ({l.capacidad} Asientos)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Revision Tecnica */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Vence Rev. Técnica *</label>
                  <input
                    type="date"
                    required
                    value={formData.revision_tecnica}
                    onChange={(e) => setFormData({ ...formData, revision_tecnica: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                {/* Permiso de Circulación */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Vence Perm. Circulación *</label>
                  <input
                    type="date"
                    required
                    value={formData.permiso_circulacion}
                    onChange={(e) => setFormData({ ...formData, permiso_circulacion: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                {/* Disponible */}
                <div className="col-span-2 flex items-center gap-2.5 pt-2">
                  <input
                    type="checkbox"
                    id="disponible-check"
                    checked={formData.disponible}
                    onChange={(e) => setFormData({ ...formData, disponible: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800 focus:ring-indigo-500"
                  />
                  <label htmlFor="disponible-check" className="text-sm text-slate-300 font-medium select-none cursor-pointer">
                    Vehículo Operativo / Disponible para Viajes
                  </label>
                </div>
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
                  <span>{editingBus ? 'Guardar Cambios' : 'Registrar Vehículo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Buses;
