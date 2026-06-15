// /utils/googleClient.js
// Helper central para la integración con Google Calendar.
import { google } from "googleapis";

// Scopes que pedimos en el consentimiento:
// - calendar.events: crear/leer/editar/borrar eventos (las dos direcciones de sync)
// - userinfo.email: saber qué cuenta de Google quedó conectada (solo para mostrarla)
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

const assertEnv = () => {
  const missing = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
  ].filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(
      `Faltan variables de entorno de Google: ${missing.join(", ")}`
    );
  }
};

// Crea un cliente OAuth2 limpio (sin credenciales de usuario todavía).
export const createOAuthClient = () => {
  assertEnv();

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

// Genera la URL del consentimiento de Google.
// `state` viaja de ida y vuelta: lo usamos para saber qué usuario está conectando.
export const buildConsentUrl = (state) => {
  const oauth2Client = createOAuthClient();

  return oauth2Client.generateAuthUrl({
    access_type: "offline", // necesario para recibir refresh_token
    prompt: "consent", // fuerza a Google a devolver siempre el refresh_token
    scope: GOOGLE_SCOPES,
    state,
  });
};

// A partir del usuario (con tokens guardados) devuelve un cliente autenticado y listo.
// Si el accessToken está vencido, googleapis lo refresca solo usando el refreshToken.
export const getAuthorizedClient = (user) => {
  const oauth2Client = createOAuthClient();

  oauth2Client.setCredentials({
    access_token: user.google?.accessToken || undefined,
    refresh_token: user.google?.refreshToken || undefined,
    expiry_date: user.google?.expiryDate || undefined,
  });

  return oauth2Client;
};
