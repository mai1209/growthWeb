import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './MainLayout';
import Dashboard from './Dashboard';
import Tareas from './Tareas';

// 1. Añadimos 'onUpdate' a la lista de props que recibe
function AppRoutes({ 
  token, 
  onLogout, 
  movimientos, 
  taskToEdit, 
  setTaskToEdit, 
  onTaskUpdate, 
  onUpdate, // <-- AÑADIDO AQUÍ
  movementToEdit,
  setMovementToEdit,
  refreshKey, 
  ...authProps 
}) {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <MainLayout 
            token={token} 
            onLogout={onLogout} 
            movimientos={movimientos}
            taskToEdit={taskToEdit}
            onTaskUpdate={onTaskUpdate}
            refreshKey={refreshKey}
          />
        }
      >
        <Route
          index
          element={
            <Dashboard
              token={token}
              refreshKey={refreshKey}
              onMovementUpdate={onUpdate} // <-- 2. Ahora 'onUpdate' está definido y se pasa correctamente
              movementToEdit={movementToEdit}
              setMovementToEdit={setMovementToEdit}
              movimientos={movimientos}
              {...authProps}
            />
          }
        />
        <Route
          path="notas"
          element={
            token ? (
              <Tareas 
                token={token} 
                refreshKey={refreshKey} 
                onEditClick={setTaskToEdit} 
              />
            ) : (
              <Navigate to="/" />
            )
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default AppRoutes;