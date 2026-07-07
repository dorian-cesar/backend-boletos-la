import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { 
  Users, 
  MapPin, 
  Layers, 
  Bus, 
  Route, 
  Calendar, 
  TrendingUp, 
  Plus, 
  AlertCircle, 
  ArrowRight,
  Clock
} from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState({
    users: 0,
    cities: 0,
    layouts: 0,
    buses: 0,
    routes: 0,
    services: 0,
  });
  const [recentServices, setRecentServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Hacer peticiones paralelas para recopilar información estadística
        const [
          usersRes,
          citiesRes,
          layoutsRes,
          busesRes,
          routesRes,
          servicesRes
        ] = await Promise.all([
          api.get('/users?limit=1').catch(() => ({ data: { total: 0 } })),
          api.get('/cities').catch(() => ({ data: { data: [] } })),
          api.get('/bus-layout').catch(() => ({ data: { data: [] } })),
          api.get('/buses').catch(() => ({ data: { data: [] } })),
          api.get('/route-masters').catch(() => ({ data: { data: [] } })),
          api.get('/services').catch(() => ({ data: [] })),
        ]);

        setStats({
          users: usersRes.data?.total || 0,
          cities: citiesRes.data?.data?.length || 0,
          layouts: layoutsRes.data?.data?.length || 0,
          buses: busesRes.data?.data?.length || 0,
          routes: routesRes.data?.data?.length || 0,
          services: Array.isArray(servicesRes.data) ? servicesRes.data.length : 0,
        });

        // Guardar servicios recientes (los últimos 5)
        const rawServices = Array.isArray(servicesRes.data) ? servicesRes.data : [];
        const sortedServices = [...rawServices]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 5);
        setRecentServices(sortedServices);

      } catch (err) {
        console.error('Error al cargar datos del dashboard:', err);
        setError('No se pudieron obtener todos los datos. Verifique que el backend esté ejecutándose.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const kpis = [
    { label: 'Usuarios Registrados', value: stats.users, icon: Users, color: 'from-blue-600 to-indigo-500', path: '/users' },
    { label: 'Ciudades de Ruta', value: stats.cities, icon: MapPin, color: 'from-emerald-600 to-teal-500', path: '/cities' },
    { label: 'Diseños de Buses', value: stats.layouts, icon: Layers, color: 'from-purple-600 to-violet-500', path: '/layouts' },
    { label: 'Flota de Buses', value: stats.buses, icon: Bus, color: 'from-rose-600 to-pink-500', path: '/buses' },
    { label: 'Rutas Operativas', value: stats.routes, icon: Route, color: 'from-amber-500 to-orange-500', path: '/routes' },
    { label: 'Servicios Generados', value: stats.services, icon: Calendar, color: 'from-indigo-600 to-violet-500', path: '/services' },
  ];

  if (loading) {
    return (
      <div className="p-6 md:p-8 space-y-8 animate-pulse">
        <div className="h-10 bg-slate-800 rounded w-1/3 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-800 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-none mb-2">
            ¡Hola, {currentUser.name || 'Administrador'}!
          </h1>
          <p className="text-slate-400 text-sm">
            Bienvenido al centro de administración de buses. Esto es lo que está pasando hoy.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 bg-slate-800/80 text-indigo-400 rounded-full border border-slate-700/60 self-start md:self-auto">
          <Clock size={14} />
          <span>Hora Local: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-amber-950/20 border border-amber-800/50 rounded-xl text-amber-200 text-sm">
          <AlertCircle size={20} className="shrink-0 text-amber-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <Link 
              key={idx} 
              to={kpi.path} 
              className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-6 flex items-center justify-between shadow-xl transition-all hover:translate-y-[-2px] group"
            >
              <div className="space-y-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
                  {kpi.label}
                </span>
                <span className="text-3xl font-extrabold text-white tracking-tight block">
                  {kpi.value}
                </span>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${kpi.color} flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-all`}>
                <Icon size={22} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Vistas Secundarias: Accesos Rápidos y Servicios Recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Servicios Recientes */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 lg:col-span-2 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="text-indigo-400" size={20} />
              Últimos Servicios Generados
            </h3>
            <Link to="/services" className="text-xs text-indigo-400 hover:underline flex items-center gap-1">
              Ver todos <ArrowRight size={12} />
            </Link>
          </div>
          <div className="h-[1px] bg-slate-800" />
          
          {recentServices.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No hay servicios generados en la base de datos.</p>
          ) : (
            <div className="space-y-3">
              {recentServices.map((service, i) => (
                <div key={i} className="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800/60 text-sm">
                  <div className="space-y-1">
                    <span className="font-semibold text-slate-200">
                      {service.origin} → {service.destination}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>Ruta: {service.routeMaster?.name || 'Desconocida'}</span>
                      <span>•</span>
                      <span>Fecha: {new Date(service.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                      {service.bus ? 'Bus Asignado' : 'Sin Bus'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Acciones Rápidas */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="text-indigo-400" size={20} />
            Accesos Rápidos
          </h3>
          <div className="h-[1px] bg-slate-800" />
          
          <div className="flex flex-col gap-3">
            <Link 
              to="/services" 
              className="flex items-center gap-3 p-3 bg-indigo-950/20 hover:bg-indigo-950/30 border border-indigo-900/40 hover:border-indigo-800/60 rounded-xl text-sm font-semibold text-indigo-300 transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                <Plus size={18} />
              </div>
              Generar Servicios del Mes
            </Link>

            <Link 
              to="/routes" 
              className="flex items-center gap-3 p-3 bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-900/40 hover:border-emerald-800/60 rounded-xl text-sm font-semibold text-emerald-300 transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                <Plus size={18} />
              </div>
              Nueva Ruta Maestra
            </Link>

            <Link 
              to="/buses" 
              className="flex items-center gap-3 p-3 bg-rose-950/20 hover:bg-rose-950/30 border border-rose-900/40 hover:border-rose-800/60 rounded-xl text-sm font-semibold text-rose-300 transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-rose-600/20 text-rose-400 flex items-center justify-center">
                <Plus size={18} />
              </div>
              Registrar Bus Nuevo
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
