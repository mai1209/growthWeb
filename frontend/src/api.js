import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:3000";

const api = axios.create({
  baseURL: API_URL,
});

// 1. INTERCEPTOR DE SOLICITUD (El que automatiza el Token)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 2. INTERCEPTOR DE RESPUESTA (El que te saca si el token vence)
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

// --- SERVICIOS SEPARADOS POR COMPONENTE ---

// Para tus tareas (Componente de Tareas)
export const taskService = {
  getAll: () => api.get("/api/task"), // ¡Ya no pasas el token!
  getByDate: (fecha) => api.get(`/api/task?fecha=${fecha}`),
  updateStatus: (taskId, data) => api.put(`/api/task/${taskId}/status`, data),
  delete: (taskId) => api.delete(`/api/task/${taskId}`),
  // AGREGAMOS ESTOS DOS:
  create: (data) => api.post("/api/task", data),
  update: (taskId, data) => api.put(`/api/task/${taskId}`, data),
};

// Para tus movimientos (Componentes LeftSide y Add)
export const movimientoService = {
  getAll: () => api.get("/api/add"),
  create: (data) => api.post("/api/add", data),
  update: (id, data) => api.put(`/api/add/${id}`, data),
};


export const authService = {
  login: (credentials) => api.post("/api/auth/login", credentials),
  signup: (userData) => api.post("/api/auth/register", userData),
};
export default api;