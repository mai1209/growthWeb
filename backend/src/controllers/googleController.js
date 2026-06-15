// /controllers/googleController.js
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import {
  buildConsentUrl,
  createOAuthClient,
} from "../utils/googleClient.js";
import { pullEventsFromGoogle } from "../utils/googleCalendar.js";

// El "state" es un JWT corto que identifica al usuario durante el ida y vuelta
// con Google (el callback es un redirect del navegador, no lleva el header Bearer).
const STATE_TTL = "10m";

const signState = (userId) =>
  jwt.sign({ userId, purpose: "google-oauth" }, process.env.JWT_SECRET, {
    expiresIn: STATE_TTL,
  });

const verifyState = (state) => {
  const decoded = jwt.verify(state, process.env.JWT_SECRET);
  if (decoded.purpose !== "google-oauth") {
    throw new Error("State inválido");
  }
  return decoded.userId;
};

const getFrontendUrl = () =>
  (process.env.FRONTEND_URL || "https://growthmanager.app").replace(/\/+$/, "");

// GET /api/google/status  → ¿está conectado? (con requireAuth)
export const getStatus = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "google.connected google.email google.connectedAt"
    );

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    return res.status(200).json({
      connected: Boolean(user.google?.connected),
      email: user.google?.email || "",
      connectedAt: user.google?.connectedAt || null,
    });
  } catch (error) {
    console.error("Google status error:", error);
    return res.status(500).json({ error: "No se pudo obtener el estado" });
  }
};

// GET /api/google/auth  → devuelve la URL de consentimiento (con requireAuth)
export const getAuthUrl = async (req, res) => {
  try {
    const state = signState(String(req.userId));
    const url = buildConsentUrl(state);
    return res.status(200).json({ url });
  } catch (error) {
    console.error("Google auth url error:", error);
    return res.status(500).json({
      error: error.message || "No se pudo generar la URL de Google",
    });
  }
};

// GET /api/google/callback  → Google redirige acá tras el consentimiento (SIN requireAuth)
export const handleCallback = async (req, res) => {
  const frontend = getFrontendUrl();
  const redirectTo = (status) =>
    res.redirect(`${frontend}/ajustes?tab=integraciones&google=${status}`);

  const { code, state, error: googleError } = req.query;

  if (googleError) {
    return redirectTo("cancelled");
  }

  if (!code || !state) {
    return redirectTo("error");
  }

  try {
    const userId = verifyState(state);

    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Email de la cuenta de Google conectada (solo para mostrarlo en Ajustes).
    // Pedimos el userinfo con una request autenticada directa (sin paquetes extra).
    let googleEmail = "";
    try {
      const profile = await oauth2Client.request({
        url: "https://www.googleapis.com/oauth2/v2/userinfo",
      });
      googleEmail = profile.data?.email || "";
    } catch (profileError) {
      console.warn("No se pudo leer el email de Google:", profileError.message);
    }

    const user = await User.findById(userId).select(
      "+google.accessToken +google.refreshToken +google.expiryDate"
    );

    if (!user) {
      return redirectTo("error");
    }

    user.google = {
      ...user.google,
      connected: true,
      email: googleEmail || user.google?.email || "",
      accessToken: tokens.access_token || "",
      // Google solo manda refresh_token la primera vez: si no viene, conservamos el anterior.
      refreshToken: tokens.refresh_token || user.google?.refreshToken || "",
      expiryDate: tokens.expiry_date || 0,
      connectedAt: new Date(),
    };

    await user.save();

    return redirectTo("connected");
  } catch (error) {
    console.error("Google callback error:", error);
    return redirectTo("error");
  }
};

// POST /api/google/sync  → trae los eventos de Google y los refleja como tareas (con requireAuth)
const normalizeWorkspace = (value) => {
  const ws = String(value || "").trim();
  return /^business(?::[a-f\d]{24})?$/i.test(ws) ? ws : "personal";
};

export const syncFromGoogle = async (req, res) => {
  try {
    const workspace = normalizeWorkspace(
      req.headers["x-workspace"] || req.query.workspace || req.body?.workspace
    );
    const result = await pullEventsFromGoogle(req.userId, workspace);

    if (!result.connected) {
      return res
        .status(400)
        .json({ error: "Google Calendar no está conectado" });
    }

    return res.status(200).json({
      ok: true,
      created: result.created,
      updated: result.updated,
      total: result.total,
    });
  } catch (error) {
    console.error("Google sync error:", error);
    return res.status(500).json({ error: "No se pudo sincronizar con Google" });
  }
};

// POST /api/google/disconnect  → desconecta la cuenta (con requireAuth)
export const disconnect = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "+google.accessToken +google.refreshToken +google.expiryDate +google.syncToken"
    );

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Intentamos revocar el token en Google (no es bloqueante si falla).
    try {
      const token = user.google?.refreshToken || user.google?.accessToken;
      if (token) {
        const oauth2Client = createOAuthClient();
        await oauth2Client.revokeToken(token);
      }
    } catch (revokeError) {
      console.warn("No se pudo revocar el token de Google:", revokeError.message);
    }

    user.google = {
      connected: false,
      email: "",
      accessToken: "",
      refreshToken: "",
      expiryDate: 0,
      syncToken: "",
      connectedAt: null,
    };

    await user.save();

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Google disconnect error:", error);
    return res.status(500).json({ error: "No se pudo desconectar" });
  }
};
