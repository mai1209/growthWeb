import axios from "axios";

const api = axios.create({
  baseURL: "", // mismo dominio
  // withCredentials: true, // solo si usás cookies
});

// 1️⃣ Interceptor de request (token automático)
api.interceptors.request.use((config) => {
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// 2️⃣ Interceptor de respuesta (si expira token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

// Servicios
export const taskService = {
  getAll: () => api.get("/api/task"),
  getByDate: (fecha) => api.get(`/api/task?fecha=${fecha}`),
  updateStatus: (taskId, data) =>
    api.put(`/api/task/${taskId}/status`, data),
  delete: (taskId) => api.delete(`/api/task/${taskId}`),
  create: (data) => api.post("/api/task", data),
  update: (taskId, data) => api.put(`/api/task/${taskId}`, data),
};

export const movimientoService = {
  getAll: () => api.get("/api/add"),
  create: (data) => api.post("/api/add", data),
  update: (id, data) => api.put(`/api/add/${id}`, data),
};

export const authService = {
  login: (credentials) =>
    api.post("/api/auth/login", credentials),
  signup: (userData) =>
    api.post("/api/auth/signup", userData),
};

export default api;