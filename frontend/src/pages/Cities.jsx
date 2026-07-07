import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  MapPin, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Loader, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

const Cities = () => {
  const [cities, setCities] = useState([]);
  const [filteredCities, setFilteredCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filtros
  const [search, setSearch] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCity, setEditingCity] = useState(null); // null for create, object for edit
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    region: ''
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchCities = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/cities');
      const data = response.data.data || [];
      setCities(data);
      setFilteredCities(data);
    } catch (err) {
      console.error('Error fetching cities:', err);
      setError(err.response?.data?.message || 'Error al obtener las ciudades.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCities();
  }, []);

  // Filtrar localmente cuando cambia la búsqueda o la lista completa de ciudades
  useEffect(() => {
    if (!search.trim()) {
      setFilteredCities(cities);
    } else {
      const query = search.toLowerCase().trim();
      const filtered = cities.filter(city => 
        city.name.toLowerCase().includes(query) || 
        city.code.toLowerCase().includes(query) ||
        (city.region && city.region.toLowerCase().includes(query))
      );
      setFilteredCities(filtered);
    }
  }, [search, cities]);

  const handleDeleteCity = async (id) => {
    if (!window.confirm('¿Está seguro de que desea desactivar esta ciudad? Dejará de aparecer en la selección de rutas.')) return;
    try {
      await api.delete(`/cities/${id}`);
      showSuccess('Ciudad desactivada correctamente.');
      fetchCities();
    } catch (err) {
      console.error('Error deleting city:', err);
      setError(err.response?.data?.message || 'Error al desactivar la ciudad.');
    }
  };

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const openCreateModal = () => {
    setEditingCity(null);
    setFormData({
      name: '',
      code: '',
      region: ''
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (city) => {
    setEditingCity(city);
    setFormData({
      name: city.name,
      code: city.code,
      region: city.region || ''
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim() || !formData.code.trim()) {
      setFormError('Nombre y Código son campos requeridos.');
      return;
    }

    setSubmitLoading(true);

    try {
      if (editingCity) {
        await api.put(`/cities/${editingCity._id}`, formData);
        showSuccess('Ciudad actualizada correctamente.');
      } else {
        await api.post('/cities', formData);
        showSuccess('Ciudad creada correctamente.');
      }
      setModalOpen(false);
      fetchCities();
    } catch (err) {
      console.error('Error saving city:', err);
      setFormError(err.response?.data?.message || 'Error al guardar la ciudad.');
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
            <MapPin className="text-indigo-400" size={26} />
            Gestión de Ciudades
          </h1>
          <p className="text-slate-400 text-sm">Configura los orígenes, destinos y paradas intermedias para tus servicios.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-600/10 text-sm self-start sm:self-auto transition-all"
        >
          <Plus size={18} />
          Agregar Ciudad
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
            placeholder="Buscar por Nombre, Código o Región..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-sm"
          />
        </div>
      </div>

      {/* Tabla de Resultados */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col justify-center items-center gap-3 text-slate-400">
            <Loader className="animate-spin text-indigo-500" size={32} />
            <span>Cargando ciudades...</span>
          </div>
        ) : filteredCities.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No se encontraron ciudades creadas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-4 px-6">Ciudad</th>
                  <th className="py-4 px-6">Código IATA / Interno</th>
                  <th className="py-4 px-6">Región / Estado</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCities.map((city) => (
                  <tr key={city._id} className="hover:bg-slate-950/20 text-slate-300 text-sm transition-all">
                    <td className="py-4 px-6 font-semibold text-white">{city.name}</td>
                    <td className="py-4 px-6 font-mono text-indigo-400 font-semibold">{city.code}</td>
                    <td className="py-4 px-6 text-slate-400">{city.region || '—'}</td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(city)}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCity(city._id)}
                          className="p-1.5 hover:bg-red-950/40 rounded-lg text-slate-400 hover:text-red-400 transition-all"
                          title="Desactivar"
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
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
              <h3 className="text-md font-bold text-white">
                {editingCity ? 'Editar Ciudad' : 'Agregar Ciudad'}
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

              <div className="space-y-4">
                {/* Nombre */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nombre de Ciudad</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Asunción"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                {/* Código */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Código (Abreviatura)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. ASU"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-sm font-semibold uppercase"
                  />
                </div>

                {/* Región */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Región / Departamento (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej. Central"
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
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
                  <span>{editingCity ? 'Guardar Cambios' : 'Agregar Ciudad'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Cities;
