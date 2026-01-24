import { useState, useEffect } from "react";
import AppRoutes from "./AppRoutes";
import { movimientoService } from "../api"; // Importamos tu nuevo servicio centralizado

const getStoredToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");

function App() {
  const [token, setToken] = useState(getStoredToken()); 
  const [ready, setReady] = useState(false); // Clave para evitar el problema del "cero"
  const [refreshKey, setRefreshKey] = useState(0);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [movementToEdit, setMovementToEdit] = useState(null);
  const [movimientos, setMovimientos] = useState([]);

  // 1. CARGA INICIAL: Sincroniza el token apenas abre la app
  useEffect(() => {
    const savedToken = getStoredToken();
    if (savedToken) {
      setToken(savedToken);
    }
    setReady(true); // Marcamos como listo una vez revisado el storage
  }, []);

  // 2. FETCH DE MOVIMIENTOS: Ahora usa el servicio centralizado
  useEffect(() => {
    let isMounted = true;

    const fetchMovimientos = async () => {
      // Si no hay token o la app no terminó de cargar el storage, no pedimos nada
      if (!token || !ready) {
        setMovimientos([]);
        return;
      }

      try {
        // Usamos el servicio. api.js ya sabe poner el token en los headers
        const res = await movimientoService.getAll(); 
        if (isMounted && res.data) {
          setMovimientos(res.data);
        }
      } catch (err) {
        // Los errores 401 los maneja el interceptor de api.js redirigiendo al login
        console.error("Error en fetchMovimientos:", err.message);
      }
    };

    fetchMovimientos();
    return () => { isMounted = false; }; 
  }, [token, refreshKey, ready]);

  // 3. SINCRONIZACIÓN ENTRE PESTAÑAS (Opcional pero recomendado)
  useEffect(() => {
    const syncToken = () => {
      const currentToken = getStoredToken();
      if (currentToken !== token) setToken(currentToken);
    };
    window.addEventListener("storage", syncToken);
    return () => window.removeEventListener("storage", syncToken);
  }, [token]);

  // Manejadores de eventos
  const handleDataUpdate = () => {
    setTaskToEdit(null);
    setMovementToEdit(null);
    setRefreshKey((prev) => prev + 1);
  };

  const handleAuthSuccess = (newToken) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    setToken(null);
  };

  // 4. PREVENCIÓN DE "PANTALLA EN CERO"
  // Si React no terminó de leer el storage, no renderizamos las rutas todavía.
  // Esto evita que te mande al login por error al recargar (F5).
  if (!ready) return null; 

  return (
    <AppRoutes
      token={token}
      onAuthSuccess={handleAuthSuccess}
      onLogout={handleLogout}
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