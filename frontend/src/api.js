import axios from "axios";

const normalizeBaseURL = (rawUrl = "") => {
  const cleaned = rawUrl.trim().replace(/\/+$/, "");

  if (!cleaned) {
    return "";
  }

  return cleaned.replace(/\/api$/i, "");
};

const resolveBaseURL = () => {
  const envBaseURL = normalizeBaseURL(process.env.REACT_APP_API_URL || "");

  if (typeof window !== "undefined") {
    const { hostname } = window.location;

    // En producción sobre Vercel usamos mismo dominio y dejamos que /api
    // resuelva al backend del mismo deploy.
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return "";
    }

    return envBaseURL || "http://localhost:3000";
  }

  return envBaseURL;
};

const api = axios.create({
  baseURL: resolveBaseURL(),
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
    const requestUrl = error.config?.url || "";
    const isAuthRequest =
      requestUrl.includes("/api/auth/login") ||
      requestUrl.includes("/api/auth/signup");

    if (error.response?.status === 401 && !isAuthRequest) {
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
  settleDebt: (id, data) => api.post(`/api/add/${id}/settle-debt`, data),
  delete: (id) => api.delete(`/api/add/${id}`),
};

export const sharedGroupsService = {
  getAll: () => api.get("/api/shared-groups"),
  getById: (id) => api.get(`/api/shared-groups/${id}`),
  create: (data) => api.post("/api/shared-groups", data),
  update: (id, data) => api.put(`/api/shared-groups/${id}`, data),
  addMember: (id, data) => api.post(`/api/shared-groups/${id}/members`, data),
  delete: (id) => api.delete(`/api/shared-groups/${id}`),
  createExpense: (id, data) => api.post(`/api/shared-groups/${id}/expenses`, data),
  createDebt: (id, data) => api.post(`/api/shared-groups/${id}/debts`, data),
  settleDebt: (groupId, debtId, data) =>
    api.post(`/api/shared-groups/${groupId}/debts/${debtId}/settle`, data),
  deleteExpense: (groupId, expenseId) =>
    api.delete(`/api/shared-groups/${groupId}/expenses/${expenseId}`),
};

export const authService = {
  login: (credentials) =>
    api.post("/api/auth/login", credentials),
  signup: (userData) =>
    api.post("/api/auth/signup", userData),
  forgotPassword: (data) => api.post("/api/auth/forgot-password", data),
  resetPassword: (data) => api.post("/api/auth/reset-password", data),
  changePassword: (data) => api.post("/api/auth/change-password", data),
};

export default api;
