import axios from "axios";
import { API_BASE_URL } from "./config";
import { getToken, getWorkspace, clearToken } from "./storage";

const api = axios.create({ baseURL: API_BASE_URL });

// Token + workspace automáticos en cada request (igual que la web)
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  const workspace = await getWorkspace();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers["X-Workspace"] = workspace;

  return config;
});

// Si el token expira (401), avisamos para mandar al login
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url = error.config?.url || "";
    const isAuthRequest =
      url.includes("/api/auth/login") || url.includes("/api/auth/signup");

    if (error.response?.status === 401 && !isAuthRequest) {
      await clearToken();
      onUnauthorized?.();
    }

    return Promise.reject(error);
  }
);

// ===== Servicios (mismos endpoints que la web) =====
export const authService = {
  login: (data) => api.post("/api/auth/login", data),
  signup: (data) => api.post("/api/auth/signup", data),
  getProfile: () => api.get("/api/auth/profile"),
  updateProfile: (data) => api.put("/api/auth/profile", data),
  changePassword: (data) => api.post("/api/auth/change-password", data),
  forgotPassword: (data) => api.post("/api/auth/forgot-password", data),
  deleteAccount: () => api.delete("/api/auth/account"),
};

export const googleService = {
  getStatus: () => api.get("/api/google/status"),
  getAuthUrl: () => api.get("/api/google/auth"),
  sync: () => api.post("/api/google/sync"),
  disconnect: () => api.post("/api/google/disconnect"),
};

export const taskService = {
  getAll: (params) => api.get("/api/task", { params }),
  create: (data) => api.post("/api/task", data),
  update: (id, data) => api.put(`/api/task/${id}`, data),
  updateStatus: (id, data) => api.put(`/api/task/${id}/status`, data),
  delete: (id) => api.delete(`/api/task/${id}`),
};

export const movimientoService = {
  getAll: (params) => api.get("/api/add", { params }),
  create: (data) => api.post("/api/add", data),
  update: (id, data) => api.put(`/api/add/${id}`, data),
  delete: (id) => api.delete(`/api/add/${id}`),
  settleDebt: (id, data) => api.post(`/api/add/${id}/settle-debt`, data),
};

export const categoriesService = {
  getAll: () => api.get("/api/categories"),
  create: (data) => api.post("/api/categories", data),
  delete: (id) => api.delete(`/api/categories/${id}`),
};

// Config de facturación (ARCA) del perfil activo (workspace va en el header).
export const fiscalService = {
  get: () => api.get("/api/fiscal-config"),
  update: (data) => api.put("/api/fiscal-config", data),
};

export const timeEntryService = {
  getAll: (params) => api.get("/api/time-entries", { params }),
  create: (data) => api.post("/api/time-entries", data),
  update: (id, data) => api.put(`/api/time-entries/${id}`, data),
  delete: (id) => api.delete(`/api/time-entries/${id}`),
};

export const sharedGroupsService = {
  getAll: () => api.get("/api/shared-groups"),
  getById: (id) => api.get(`/api/shared-groups/${id}`),
  create: (data) => api.post("/api/shared-groups", data),
  delete: (id) => api.delete(`/api/shared-groups/${id}`),
  createExpense: (id, data) => api.post(`/api/shared-groups/${id}/expenses`, data),
  updateExpense: (groupId, expenseId, data) =>
    api.put(`/api/shared-groups/${groupId}/expenses/${expenseId}`, data),
  deleteExpense: (groupId, expenseId) =>
    api.delete(`/api/shared-groups/${groupId}/expenses/${expenseId}`),
  addMember: (id, data) => api.post(`/api/shared-groups/${id}/members`, data),
  createDebt: (id, data) => api.post(`/api/shared-groups/${id}/debts`, data),
  settleDebt: (groupId, debtId, data) =>
    api.post(`/api/shared-groups/${groupId}/debts/${debtId}/settle`, data),
};

export default api;
