import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Mail, ShieldCheck, Lock, AlertCircle, Loader } from 'lucide-react';

const Login = () => {
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' or 'rut'
  const [identifier, setIdentifier] = useState(''); // email or rut value
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Por favor complete todos los campos');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      let response;
      if (loginMethod === 'email') {
        response = await api.post('/auth/email', {
          email: identifier,
          password: password
        });
      } else {
        response = await api.post('/auth/rut', {
          rut: identifier,
          password: password
        });
      }

      const { token, user } = response.data;

      // Verificar que el usuario tenga rol administrativo
      if (user.role !== 'admin' && user.role !== 'superAdmin') {
        setError('Acceso denegado: Se requiere rol de administrador.');
        setLoading(false);
        return;
      }

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      navigate('/');
    } catch (err) {
      console.error('Error de autenticación:', err);
      setError(
        err.response?.data?.message || 
        'Error de conexión con el servidor. Intente más tarde.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Elementos decorativos de fondo */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl p-8 relative z-10">
        
        {/* Encabezado / Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-indigo-500/20 mb-3">
            B
          </div>
          <h2 className="text-2xl font-bold text-white leading-tight">Panel Administrativo</h2>
          <p className="text-slate-400 text-sm mt-1">Gestión de Transporte Boletos</p>
        </div>

        {/* Pestañas de método de login */}
        <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-xl mb-6 border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setLoginMethod('email');
              setIdentifier('');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all ${
              loginMethod === 'email' 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMethod('rut');
              setIdentifier('');
              setError(null);
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition-all ${
              loginMethod === 'rut' 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            RUT
          </button>
        </div>

        {/* Alerta de Error */}
        {error && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-red-950/20 border border-red-800/50 rounded-xl text-red-200 text-sm">
            <AlertCircle size={20} className="shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {loginMethod === 'email' ? 'Correo Electrónico' : 'RUT del Usuario'}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                {loginMethod === 'email' ? <Mail size={18} /> : <ShieldCheck size={18} />}
              </span>
              <input
                type={loginMethod === 'email' ? 'email' : 'text'}
                placeholder={loginMethod === 'email' ? 'ejemplo@correo.com' : '12345678-9'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Contraseña
              </label>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock size={18} />
              </span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-600/10 flex justify-center items-center gap-2 text-sm mt-8"
          >
            {loading ? (
              <>
                <Loader size={18} className="animate-spin" />
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <span>Ingresar al Sistema</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
