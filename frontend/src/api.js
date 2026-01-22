import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

// Creamos una instancia personalizada
const api = axios.create({
  baseURL: API_URL,
});

// Interceptor para el 401 y limpieza de tokens
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

// Definimos las funciones de tareas (Data Access Layer)
export const taskService = {
  getAll: (token) => 
    api.get("/api/task", { headers: { Authorization: `Bearer ${token}` } }),
    
  getByDate: (token, fecha) => 
    api.get(`/api/task?fecha=${fecha}`, { headers: { Authorization: `Bearer ${token}` } }),
    
  updateStatus: (token, taskId, data) => 
    api.put(`/api/task/${taskId}/status`, data, { headers: { Authorization: `Bearer ${token}` } }),
    
  delete: (token, taskId) => 
    api.delete(`/api/task/${taskId}`, { headers: { Authorization: `Bearer ${token}` } }),
};

//defino las funciones de leftside.jsx

export const movimientoService = {
  // Le pusimos "getAll" porque trae todos los movimientos del usuario
  getAll: (token) => api.get("/api/add", { headers: { Authorization: `Bearer ${token}` } }),
};

export default api;