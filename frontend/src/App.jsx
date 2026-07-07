import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Cities from './pages/Cities';
import BusLayouts from './pages/BusLayouts';
import Buses from './pages/Buses';
import RouteMasters from './pages/RouteMasters';
import Services from './pages/Services';

// Envoltura de diseño para todas las vistas administrativas protegidas
const AdminLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 md:pl-64 bg-slate-950 min-h-screen">
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Ruta pública de Login */}
        <Route path="/login" element={<Login />} />

        {/* Rutas de Administración Protegidas */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Dashboard />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['admin', 'superAdmin']}>
              <AdminLayout>
                <Users />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cities"
          element={
            <ProtectedRoute allowedRoles={['admin', 'superAdmin']}>
              <AdminLayout>
                <Cities />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/layouts"
          element={
            <ProtectedRoute allowedRoles={['admin', 'superAdmin']}>
              <AdminLayout>
                <BusLayouts />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/buses"
          element={
            <ProtectedRoute allowedRoles={['admin', 'superAdmin']}>
              <AdminLayout>
                <Buses />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/routes"
          element={
            <ProtectedRoute allowedRoles={['admin', 'superAdmin']}>
              <AdminLayout>
                <RouteMasters />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/services"
          element={
            <ProtectedRoute>
              <AdminLayout>
                <Services />
              </AdminLayout>
            </ProtectedRoute>
          }
        />

        {/* Redirección por defecto */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
