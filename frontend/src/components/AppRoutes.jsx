import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import MainLayout from "./MainLayout";
import Dashboard from "./Dashboard";
import Add from "./Add";
import Tareas from "./Tareas";

import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";

function AppRoutes({
  token,
  onAuthSuccess,
  onLogout,
  movimientos,
  taskToEdit,
  setTaskToEdit,
  onTaskUpdate,
  onUpdate,
  movementToEdit,
  setMovementToEdit,
  refreshKey,
  ...authProps
}) {
  /* =====================================================
     🔓 RUTAS PÚBLICAS (NO LOGUEADO)
  ===================================================== */
  if (!token) {
    return (
      <Routes>
        {/* Login es la pantalla inicial */}
        <Route
          path="/"
          element={<Navigate to="/login" />}
        />

        <Route
          path="/login"
          element={<LoginPage onAuthSuccess={onAuthSuccess} />}
        />

        <Route
          path="/register"
          element={<SignupPage onAuthSuccess={onAuthSuccess} />}
        />

        {/* Cualquier otra ruta → login */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  /* =====================================================
     🔒 RUTAS PRIVADAS (LOGUEADO)
  ===================================================== */
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
            onUpdate={onUpdate}
          />
        }
      >
        {/* Dashboard */}
        <Route
          index
          element={
            <Dashboard
              token={token}
              refreshKey={refreshKey}
              onMovementUpdate={onUpdate}
              movementToEdit={movementToEdit}
              setMovementToEdit={setMovementToEdit}
              movimientos={movimientos}
              {...authProps}
            />
          }
        />

        {/* Agregar / editar movimientos */}
        <Route
          path="add"
          element={
            <Add
              onMovementAdded={onUpdate}
              movementToEdit={movementToEdit}
              {...authProps}
            />
          }
        />

        {/* Notas / tareas */}
        <Route
          path="notas"
          element={
            <Tareas
             token={token}
              refreshKey={refreshKey}
              onEditClick={setTaskToEdit}
            />
          }
        />

        {/* Cualquier otra ruta privada → dashboard */}
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
