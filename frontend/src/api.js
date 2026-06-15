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

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return envBaseURL || "http://localhost:3000";
    }

    return envBaseURL;
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
  const storedWorkspace = String(localStorage.getItem("activeWorkspace") || "").trim();
  const workspace = /^business(?::[a-f\d]{24})?$/i.test(storedWorkspace)
    ? storedWorkspace
    : "personal";

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers["X-Workspace"] = workspace;

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
      const hadToken = Boolean(
        localStorage.getItem("token") || sessionStorage.getItem("token")
      );
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      // Solo redirigimos (con aviso) si había una sesión activa que expiró.
      if (hadToken && typeof window !== "undefined") {
        window.location.href = "/login?expired=1";
      }
    }
    return Promise.reject(error);
  }
);

// Servicios
export const taskService = {
  getAll: (params = {}) => api.get("/api/task", { params }),
  getByDate: (fecha, params = {}) => api.get("/api/task", { params: { fecha, ...params } }),
  updateStatus: (taskId, data) =>
    api.put(`/api/task/${taskId}/status`, data),
  delete: (taskId) => api.delete(`/api/task/${taskId}`),
  create: (data) => api.post("/api/task", data),
  update: (taskId, data) => api.put(`/api/task/${taskId}`, data),
};

export const movimientoService = {
  getAll: (params = {}) => api.get("/api/add", { params }),
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

export const googleService = {
  // Estado de la conexión con Google Calendar del usuario logueado
  getStatus: () => api.get("/api/google/status"),
  // Devuelve { url } para mandar al usuario al consentimiento de Google
  getAuthUrl: () => api.get("/api/google/auth"),
  // Trae los eventos de Google y los refleja como tareas (Calendar → Web)
  sync: () => api.post("/api/google/sync"),
  disconnect: () => api.post("/api/google/disconnect"),
};

export const authService = {
  login: (credentials) =>
    api.post("/api/auth/login", credentials),
  signup: (userData) =>
    api.post("/api/auth/signup", userData),
  forgotPassword: (data) => api.post("/api/auth/forgot-password", data),
  resetPassword: (data) => api.post("/api/auth/reset-password", data),
  changePassword: (data) => api.post("/api/auth/change-password", data),
  getProfile: () => api.get("/api/auth/profile"),
  updateProfile: (data) => api.put("/api/auth/profile", data),
};

export default api;
