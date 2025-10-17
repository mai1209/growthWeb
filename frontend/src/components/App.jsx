import { useState, useEffect } from 'react';
import axios from 'axios';
import AppRoutes from './AppRoutes';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activeView, setActiveView] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // --- Estado para TAREAS ---
  const [taskToEdit, setTaskToEdit] = useState(null);

  // --- Estado para MOVIMIENTOS ---
  const [movementToEdit, setMovementToEdit] = useState(null);
  const [movimientos, setMovimientos] = useState([]);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

  // useEffect para buscar los movimientos (para el sidebar y el dashboard)
  useEffect(() => {
    const fetchMovimientos = async () => {
      if (!token) {
        setMovimientos([]);
        return;
      }
      try {
        const res = await axios.get(`${API_URL}/api/add`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMovimientos(res.data);
      } catch (err) {
        console.error("Error al obtener movimientos en App.js:", err);
        setMovimientos([]);
      }
    };
    fetchMovimientos();
  }, [token, refreshKey, API_URL]);

  // Función unificada que refresca datos y limpia los formularios de edición
  const handleDataUpdate = () => {
    setTaskToEdit(null);      // Limpia el formulario de tareas
    setMovementToEdit(null);  // Limpia el formulario de movimientos
    setRefreshKey(prevKey => prevKey + 1); // Fuerza la actualización de datos
  };

  const handleAuthSuccess = (newToken) => {
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setActiveView(null);
    setRefreshKey(prevKey => prevKey + 1); // Fuerza la recarga de movimientos
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };
  
  const handleLoginClick = () => setActiveView("login");
  const handleCloseModal = () => setActiveView(null);

  return (
 
      <AppRoutes
        token={token}
        onAuthSuccess={handleAuthSuccess}
        onLogout={handleLogout}
        onLoginClick={handleLoginClick}
        onCloseModal={handleCloseModal}
        activeView={activeView}
        
        refreshKey={refreshKey}
        onUpdate={handleDataUpdate}
        
        movimientos={movimientos}
        movementToEdit={movementToEdit}
        setMovementToEdit={setMovementToEdit}
        
        taskToEdit={taskToEdit}
        setTaskToEdit={setTaskToEdit}
      />
  
  );
}

export default App;