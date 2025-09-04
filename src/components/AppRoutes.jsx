// src/AppRoutes.jsx

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Importamos los componentes que vamos a usar en las rutas
import MainLayout from './MainLayout';
import Dashboard from './Dashboard';
import Tareas from './Tareas';

function AppRoutes({ token, onAuthSuccess, onLoginClick, onCloseModal, activeView, onMovementAdded, onLogout, movimientos, refreshKey }) {
  return (
    <Routes>
      {/* Ruta Padre que renderiza el Layout principal. SIEMPRE está activa. */}
      <Route
        path="/"
        element={<MainLayout token={token} onLogout={onLogout} movimientos={movimientos} />}
      >
        {/* Ruta Hija 1 (índice): Muestra el Dashboard en la URL "/" */}
        <Route
          index
          element={
            <Dashboard
              token={token}
              onAuthSuccess={onAuthSuccess}
              onLoginClick={onLoginClick}
              onCloseModal={onCloseModal}
              activeView={activeView}
              onMovementAdded={onMovementAdded}
              movimientos={movimientos}
              refreshKey={refreshKey}
            />
          }
        />

        {/* Ruta Hija 2: Muestra las Notas en la URL "/notas" */}
        {/* Solo se puede acceder si hay un token */}
        <Route
          path="notas"
         element={token ? <Tareas token={token} refreshKey={refreshKey} /> : <Navigate to="/" />}/>
        
        {/* AQUÍ PUEDES AÑADIR MÁS RUTAS EN EL FUTURO */}
      </Route>

      {/* Si alguien escribe una URL que no existe, lo redirigimos al inicio */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default AppRoutes;