// src/App.js

import { useState, useEffect } from "react";
import axios from "axios";
import AppRoutes from "./AppRoutes"; // El nuevo componente que manejará las rutas

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [activeView, setActiveView] = useState(null); // Para el modal de login
  const [refreshKey, setRefreshKey] = useState(0);
  const [movimientos, setMovimientos] = useState([]);

  useEffect(() => {
    const fetchMovimientos = async () => {
      if (!token) {
        setMovimientos([]);
        return;
      }
      try {
        const res = await axios.get("http://localhost:3000/api/add", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMovimientos(res.data);
      } catch (err) {
        console.error("Error al obtener movimientos:", err);
        setMovimientos([]);
      }
    };
    fetchMovimientos();
  }, [token, refreshKey]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };
  const handleMovementAdded = () => setRefreshKey((prevKey) => prevKey + 1);
  const handleAuthSuccess = (newToken) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setActiveView(null);
  };
  const handleLoginClick = () => setActiveView("login");
  const handleCloseModal = () => setActiveView(null);


  return (
    <AppRoutes
      token={token}
      onAuthSuccess={handleAuthSuccess}
      onLoginClick={handleLoginClick}
      onCloseModal={handleCloseModal}
      activeView={activeView}
      onMovementAdded={handleMovementAdded}
      onLogout={handleLogout}
      movimientos={movimientos}
      refreshKey={refreshKey}
    />
  );
}

export default App;