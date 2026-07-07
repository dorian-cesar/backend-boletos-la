import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  Users as UsersIcon, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  ToggleLeft, 
  ToggleRight, 
  X, 
  Loader, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filtros y Paginación
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activoFilter, setActivoFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 8;

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null for create, object for edit
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    rut: '',
    password: '',
    role: 'usuario',
    activo: true
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const roles = [
    { value: 'usuario', label: 'Usuario General' },
    { value: 'admin', label: 'Administrador' },
    { value: 'superAdmin', label: 'Super Administrador' },
    { value: 'conductor', label: 'Conductor' },
    { value: 'auxiliar', label: 'Auxiliar' },
    { value: 'visita', label: 'Visita' }
  ];

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/users', {
        params: {
          page,
          limit,
          search,
          role: roleFilter,
          activo: activoFilter !== '' ? activoFilter : undefined
        }
      });
      
      setUsers(response.data.items || []);
      setTotalPages(response.data.pages || 1);
      setTotalItems(response.data.total || 0);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.response?.data?.message || 'Error al obtener usuarios de la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter, activoFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleToggleActivo = async (user) => {
    try {
      const response = await api.patch(`/users/${user._id}/activar`);
      showSuccess(response.data.message || 'Estado actualizado.');
      fetchUsers();
    } catch (err) {
      console.error('Error toggling activo:', err);
      setError(err.response?.data?.message || 'No se pudo cambiar el estado del usuario.');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('¿Está seguro de que desea eliminar permanentemente a este usuario?')) return;
    try {
      await api.delete(`/users/${id}`);
      showSuccess('Usuario eliminado exitosamente.');
      if (users.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        fetchUsers();
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(err.response?.data?.message || 'Error al eliminar usuario.');
    }
  };

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      rut: '',
      password: '',
      role: 'usuario',
      activo: true
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      rut: user.rut,
      password: '', // no mostrar la contraseña actual
      role: user.role,
      activo: user.activo
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Validación básica en frontend
    if (!formData.name.trim() || !formData.email.trim() || !formData.rut.trim()) {
      setFormError('Nombre, Email y RUT son campos requeridos.');
      return;
    }

    if (!editingUser && (!formData.password || formData.password.length < 8)) {
      setFormError('La contraseña es requerida y debe tener al menos 8 caracteres.');
      return;
    }

    if (editingUser && formData.password && formData.password.length < 8) {
      setFormError('Si vas a cambiar la contraseña, debe tener al menos 8 caracteres.');
      return;
    }

    setSubmitLoading(true);

    try {
      if (editingUser) {
        // payload sin password si está vacío
        const payload = { ...formData };
        if (!payload.password) delete payload.password;
        await api.put(`/users/${editingUser._id}`, payload);
        showSuccess('Usuario actualizado exitosamente.');
      } else {
        await api.post('/users', formData);
        showSuccess('Usuario creado exitosamente.');
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error('Error saving user:', err);
      setFormError(err.response?.data?.message || 'Error al guardar el usuario.');
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
            <UsersIcon className="text-indigo-400" size={26} />
            Gestión de Usuarios
          </h1>
          <p className="text-slate-400 text-sm">Administra la lista de usuarios y tripulantes de la plataforma.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-600/10 text-sm self-start sm:self-auto transition-all"
        >
          <Plus size={18} />
          Crear Usuario
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
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Buscador de texto */}
            <div className="relative col-span-1 sm:col-span-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Buscar por Nombre, Email, RUT..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>

            {/* Selector de Rol */}
            <div>
              <select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 focus:outline-none focus:border-indigo-500 text-sm"
              >
                <option value="">Todos los Roles</option>
                {roles.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Selector de Estado */}
            <div>
              <select
                value={activoFilter}
                onChange={(e) => { setActivoFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 focus:outline-none focus:border-indigo-500 text-sm"
              >
                <option value="">Todos los Estados</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </div>
          </div>
          
          <button
            type="submit"
            className="w-full md:w-auto px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition-all"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Tabla de Resultados */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col justify-center items-center gap-3 text-slate-400">
            <Loader className="animate-spin text-indigo-500" size={32} />
            <span>Cargando usuarios...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No se encontraron usuarios con los criterios de búsqueda actuales.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-4 px-6">Usuario</th>
                  <th className="py-4 px-6">RUT</th>
                  <th className="py-4 px-6">Rol</th>
                  <th className="py-4 px-6 text-center">Estado</th>
                  <th className="py-4 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-slate-950/20 text-slate-300 text-sm transition-all">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-indigo-400">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white leading-snug">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono text-slate-400">{user.rut}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'superAdmin' ? 'bg-purple-950/60 text-purple-300 border border-purple-800/30' :
                        user.role === 'admin' ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/30' :
                        user.role === 'conductor' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/30' :
                        user.role === 'auxiliar' ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/30' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => handleToggleActivo(user)}
                        className={`inline-flex items-center gap-1.5 focus:outline-none transition-all ${
                          user.activo ? 'text-indigo-400 hover:text-indigo-300' : 'text-slate-600 hover:text-slate-500'
                        }`}
                      >
                        {user.activo ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                        <span className="text-xs font-medium w-12 text-left capitalize">
                          {user.activo ? 'activo' : 'inactivo'}
                        </span>
                      </button>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user._id)}
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

        {/* Paginación */}
        {!loading && totalItems > 0 && (
          <div className="bg-slate-950/40 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800">
            <span className="text-xs text-slate-500">
              Mostrando página <strong className="text-slate-300">{page}</strong> de <strong className="text-slate-300">{totalPages}</strong> ({totalItems} usuarios en total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Ventana de Creación / Edición */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
              <h3 className="text-md font-bold text-white">
                {editingUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
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
                {/* Nombre */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nombre Completo</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                {/* Email */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                {/* RUT */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">RUT</label>
                  <input
                    type="text"
                    required
                    placeholder="12345678-9"
                    value={formData.rut}
                    onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                {/* Password */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    {editingUser ? 'Contraseña (Opcional)' : 'Contraseña'}
                  </label>
                  <input
                    type="password"
                    placeholder={editingUser ? 'Dejar vacío para no cambiar' : 'Mínimo 8 caracteres'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                {/* Rol */}
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Rol</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-400 focus:outline-none focus:border-indigo-500 text-sm"
                  >
                    {roles.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                {/* Activo Checkbox */}
                <div className="col-span-2 flex items-center gap-2.5 pt-2">
                  <input
                    type="checkbox"
                    id="activo-check"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-800 focus:ring-indigo-500"
                  />
                  <label htmlFor="activo-check" className="text-sm text-slate-300 font-medium select-none cursor-pointer">
                    Usuario Habilitado / Activo
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
                  <span>{editingUser ? 'Guardar Cambios' : 'Crear Usuario'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Users;
