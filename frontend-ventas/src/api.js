import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token a las peticiones con Login Silencioso
api.interceptors.request.use(
  async (config) => {
    // Si la petición es para el login, no interceptar
    if (config.url.includes('/auth/email') || config.url.includes('/auth/rut')) {
      return config;
    }

    let token = localStorage.getItem('client_token');

    // Si no hay token, iniciamos sesión en segundo plano con la cuenta admin por defecto para poder usar las APIs
    if (!token) {
      try {
        const response = await axios.post(
          (import.meta.env.VITE_API_URL || 'http://localhost:4000/api') + '/auth/email',
          {
            email: 'admin@wit.la',
            password: 'witla951',
          }
        );
        token = response.data.token;
        localStorage.setItem('client_token', token);
        localStorage.setItem('client_user', JSON.stringify(response.data.user));
      } catch (err) {
        console.error('Error en el login automático en segundo plano:', err);
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar tokens expirados
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      localStorage.removeItem('client_token');
      
      // Intentar login silencioso de nuevo
      try {
        const response = await axios.post(
          (import.meta.env.VITE_API_URL || 'http://localhost:4000/api') + '/auth/email',
          {
            email: 'admin@wit.la',
            password: 'witla951',
          }
        );
        const token = response.data.token;
        localStorage.setItem('client_token', token);
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (err) {
        console.error('Re-login silencioso fallido:', err);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
