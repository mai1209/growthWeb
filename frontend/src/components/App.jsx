import { useState, useEffect } from "react";
import axios from "axios";
import AppRoutes from "./AppRoutes";

// 1. INTERCEPTOR GLOBAL (Mantenlo aquí, fuera de la función App)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      // Usamos href para resetear todo el estado de la memoria de React
      window.location.href = "/"; 
    }
    return Promise.reject(error);
  }
);

const getStoredToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");

function App() {
  const [token, setToken] = useState(getStoredToken); // Pasamos la función, no el resultado, para optimizar
  const [activeView, setActiveView] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [movementToEdit, setMovementToEdit] = useState(null);
  const [movimientos, setMovimientos] = useState([]);

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

  // 2. FETCH DE MOVIMIENTOS SEGURO
  useEffect(() => {
    let isMounted = true; // Para evitar actualizar estado si el componente se desmonta

    const fetchMovimientos = async () => {
      if (!token) {
        setMovimientos([]);
        return;
      }
      try {
        const res = await axios.get(`${API_URL}/api/add`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isMounted && res.data) {
          setMovimientos(res.data);
        }
      } catch (err) {
        // Si es 401, el interceptor ya se encarga.
        // Si es otro error (red, 500), mantenemos los movimientos anteriores 
        // o mostramos un mensaje, pero NO los borramos para que la web no parpadee en blanco.
        console.error("Error en fetchMovimientos:", err.message);
      }
    };

    fetchMovimientos();
    return () => { isMounted = false; }; 
  }, [token, refreshKey, API_URL]);

  // 3. SINCRONIZACIÓN DE TOKEN (Solo Storage)
  useEffect(() => {
    const syncToken = () => {
      const currentToken = getStoredToken();
      if (currentToken !== token) {
        setToken(currentToken);
      }
    };

    window.addEventListener("storage", syncToken);
    return () => window.removeEventListener("storage", syncToken);
  }, [token]);

  const handleDataUpdate = () => {
    setTaskToEdit(null);
    setMovementToEdit(null);
    setRefreshKey((prevKey) => prevKey + 1);
  };

  const handleAuthSuccess = (newToken) => {
    // ❌ ya NO guardar acá
    setToken(newToken);
    setActiveView(null);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    setToken(null);
  };

  const handleLoginClick = () => setActiveView("login");
  const handleCloseModal = () => setActiveView(null);

  const handleAddMovement = () => {
    setMovementToEdit(null);
    setActiveView(null);
  };

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
      onAddMovement={handleAddMovement}
    />
  );
}

export default App;
