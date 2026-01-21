import { useState, useEffect } from "react";
import axios from "axios";
import AppRoutes from "./AppRoutes";

const getStoredToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");

function App() {
  const [token, setToken] = useState(getStoredToken());
  const [activeView, setActiveView] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [taskToEdit, setTaskToEdit] = useState(null);
  const [movementToEdit, setMovementToEdit] = useState(null);
  const [movimientos, setMovimientos] = useState([]);

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

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
        const status = err?.response?.status;

        // ✅ Si el backend responde "no autorizado" => token inválido/expirado
        if (status === 401) {
          localStorage.removeItem("token");
          sessionStorage.removeItem("token");
          setToken(null);
          setMovimientos([]);
          return;
        }

        // ✅ Otros errores: red, 500, etc. No borres token.
        console.error("Error al obtener movimientos en App.js:", err);
        setMovimientos([]);
      }
    };
    fetchMovimientos();
  }, [token, refreshKey, API_URL]);

  useEffect(() => {
    const syncToken = () => setToken(getStoredToken());

    window.addEventListener("storage", syncToken);
    window.addEventListener("focus", syncToken);

    return () => {
      window.removeEventListener("storage", syncToken);
      window.removeEventListener("focus", syncToken);
    };
  }, []);

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
