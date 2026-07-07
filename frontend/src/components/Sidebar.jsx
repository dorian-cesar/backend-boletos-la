import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  Layers, 
  Bus, 
  Route, 
  Calendar, 
  LogOut, 
  Menu, 
  X 
} from 'lucide-react';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  
  const userJson = localStorage.getItem('user');
  let user = { name: 'Administrador', role: 'admin' };
  if (userJson) {
    try {
      user = JSON.parse(userJson);
    } catch (e) {}
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/users', label: 'Usuarios', icon: Users },
    { to: '/cities', label: 'Ciudades', icon: MapPin },
    { to: '/layouts', label: 'Diseños de Bus', icon: Layers },
    { to: '/buses', label: 'Buses', icon: Bus },
    { to: '/routes', label: 'Rutas Maestras', icon: Route },
    { to: '/services', label: 'Servicios', icon: Calendar },
  ];

  const activeStyle = "flex items-center gap-3 px-4 py-3 rounded-lg bg-indigo-600 text-white font-medium shadow-lg shadow-indigo-600/20 transition-all";
  const inactiveStyle = "flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all";

  return (
    <>
      {/* Botón de Menú Móvil */}
      <div className="flex md:hidden items-center justify-between bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white">B</div>
          <span className="font-semibold text-white tracking-wider">BUS-PARAGUAY</span>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="text-slate-400 hover:text-white p-1 rounded-lg focus:outline-none"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay para Móvil */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Contenedor */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 md:z-20 w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between
        transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out
      `}>
        {/* Header / Logo */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/10">
              B
            </div>
            <div>
              <h1 className="text-md font-bold text-white tracking-wider leading-none m-0">BUS SYSTEM</h1>
              <span className="text-[10px] text-indigo-400 font-semibold tracking-widest uppercase">Admin Panel</span>
            </div>
          </div>
          <div className="h-[1px] bg-slate-800 w-full mt-6" />
        </div>

        {/* Menú de Navegación */}
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) => isActive ? activeStyle : inactiveStyle}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Usuario y Logout */}
        <div className="p-4 bg-slate-950/40 border-t border-slate-800/80">
          <div className="flex items-center gap-3 px-2 py-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-semibold text-indigo-400">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-200 truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user.role}</p>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-400 hover:bg-red-950/20 hover:text-red-300 font-medium transition-all"
          >
            <LogOut size={18} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
