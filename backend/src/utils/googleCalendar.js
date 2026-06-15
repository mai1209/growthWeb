// /utils/googleCalendar.js
// Sincronización Web → Google Calendar (Fase 2).
// Regla de oro: si algo de Google falla, NO debe romper el guardado de la tarea.
import { google } from "googleapis";
import User from "../models/userModel.js";
import { getAuthorizedClient } from "./googleClient.js";

// Zona horaria del usuario. Argentina = UTC-3 (sin horario de verano).
// TODO (futuro): hacerlo configurable por usuario.
const TIME_ZONE = "America/Argentina/Buenos_Aires";
const TZ_OFFSET_HOURS = 3;

// Mapa de días (como los guarda taskModel) → BYDAY de la regla RRULE de Google.
const DAY_TO_RRULE = { D: "SU", L: "MO", M: "TU", MI: "WE", J: "TH", V: "FR", S: "SA" };

const pad = (n) => String(n).padStart(2, "0");
const toYMD = (d) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

const hasTime = (horario) => typeof horario === "string" && /^\d{1,2}:\d{2}$/.test(horario);

// Construye el cuerpo del evento a partir de una tarea/nota.
const buildEventFromTask = (task) => {
  const fecha = new Date(task.fecha);
  const event = {
    summary: task.meta || "Nota",
    description: task.contenido || "",
  };

  if (hasTime(task.horario)) {
    // Evento con hora: lo armamos en UTC aplicando el offset de Argentina.
    const [hh, mm] = task.horario.split(":").map(Number);
    const startUTC = new Date(
      Date.UTC(
        fecha.getUTCFullYear(),
        fecha.getUTCMonth(),
        fecha.getUTCDate(),
        hh + TZ_OFFSET_HOURS,
        mm
      )
    );
    const endUTC = new Date(startUTC.getTime() + 60 * 60 * 1000); // +1 hora
    event.start = { dateTime: startUTC.toISOString(), timeZone: TIME_ZONE };
    event.end = { dateTime: endUTC.toISOString(), timeZone: TIME_ZONE };
  } else {
    // Sin hora: evento de día completo (la fecha de fin es exclusiva → día siguiente).
    const next = new Date(fecha.getTime() + 24 * 60 * 60 * 1000);
    event.start = { date: toYMD(fecha) };
    event.end = { date: toYMD(next) };
  }

  // Recurrencia semanal según los días marcados.
  if (task.esRecurrente && Array.isArray(task.diasRepeticion) && task.diasRepeticion.length) {
    const byDay = task.diasRepeticion
      .map((d) => DAY_TO_RRULE[d])
      .filter(Boolean)
      .join(",");
    if (byDay) {
      event.recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${byDay}`];
    }
  }

  return event;
};

// Devuelve un cliente de Calendar autenticado y persiste los tokens si Google los refresca.
const getCalendarForUser = (user) => {
  const oauth2Client = getAuthorizedClient(user);

  // Cuando googleapis refresca el access_token, guardamos el nuevo en la DB.
  oauth2Client.on("tokens", async (tokens) => {
    try {
      const update = {};
      if (tokens.access_token) update["google.accessToken"] = tokens.access_token;
      if (tokens.expiry_date) update["google.expiryDate"] = tokens.expiry_date;
      if (tokens.refresh_token) update["google.refreshToken"] = tokens.refresh_token;
      if (Object.keys(update).length) {
        await User.updateOne({ _id: user._id }, { $set: update });
      }
    } catch (error) {
      console.warn("No se pudo guardar el token refrescado:", error.message);
    }
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
};

// Carga el usuario con los tokens (que son select:false en el modelo).
const loadUserWithTokens = (userId) =>
  User.findById(userId).select(
    "google.connected +google.accessToken +google.refreshToken +google.expiryDate"
  );

// Crea o actualiza el evento de la tarea en Google Calendar.
// Devuelve el googleEventId (o null si el usuario no está conectado / hubo error).
export const syncTaskToGoogle = async (userId, task) => {
  try {
    const user = await loadUserWithTokens(userId);

    if (!user?.google?.connected || !user.google?.refreshToken) {
      return null; // El usuario no conectó Google: no hacemos nada.
    }

    const calendar = getCalendarForUser(user);
    const requestBody = buildEventFromTask(task);

    if (task.googleEventId) {
      // Ya existía: lo actualizamos.
      await calendar.events.update({
        calendarId: "primary",
        eventId: task.googleEventId,
        requestBody,
      });
      return task.googleEventId;
    }

    // No existía: lo creamos y guardamos el ID en la tarea.
    const { data } = await calendar.events.insert({
      calendarId: "primary",
      requestBody,
    });

    if (data?.id) {
      const Task = (await import("../models/taskModel.js")).default;
      await Task.updateOne({ _id: task._id }, { $set: { googleEventId: data.id } });
    }

    return data?.id || null;
  } catch (error) {
    console.warn("syncTaskToGoogle falló (la tarea se guardó igual):", error.message);
    return null;
  }
};

// ===== Fase 3: Calendar → Web =====

// Convierte un evento de Google en los campos de una tarea de la app.
const mapEventToTaskFields = (event) => {
  const startObj = event.start || {};
  let fecha = null;
  let horario = "";

  if (startObj.date) {
    // Evento de día completo → guardamos la fecha a mediodía UTC (como hace la app).
    const [y, m, d] = startObj.date.split("-").map(Number);
    fecha = new Date(Date.UTC(y, m - 1, d, 12));
  } else if (startObj.dateTime) {
    // Evento con hora → pasamos el instante a hora local de Argentina.
    const dt = new Date(startObj.dateTime);
    const art = new Date(dt.getTime() - TZ_OFFSET_HOURS * 60 * 60 * 1000);
    fecha = new Date(
      Date.UTC(art.getUTCFullYear(), art.getUTCMonth(), art.getUTCDate(), 12)
    );
    horario = `${pad(art.getUTCHours())}:${pad(art.getUTCMinutes())}`;
  }

  return {
    meta: event.summary || "(sin título)",
    contenido: event.description || "",
    fecha,
    horario,
  };
};

// Límite de tareas nuevas por sincronización (evita floods de eventos recurrentes nativos).
const MAX_NEW_PER_SYNC = 100;

// Trae los eventos del Google Calendar del usuario y los refleja como tareas en la app.
// `workspace`: dónde se crean las tareas nuevas (el workspace activo del usuario).
export const pullEventsFromGoogle = async (userId, workspace = "personal") => {
  const user = await loadUserWithTokens(userId);

  if (!user?.google?.connected || !user.google?.refreshToken) {
    return { connected: false, created: 0, updated: 0 };
  }

  const calendar = getCalendarForUser(user);
  const Task = (await import("../models/taskModel.js")).default;

  // Ventana de tiempo: 30 días atrás → 180 días adelante.
  const timeMin = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

  // 1) Traemos todos los eventos (paginado).
  const events = [];
  let pageToken;
  do {
    const { data } = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      showDeleted: false,
      maxResults: 250,
      orderBy: "startTime",
      pageToken,
    });
    events.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  // 2) Upsert de cada evento como tarea.
  let created = 0;
  let updated = 0;
  let capped = 0;

  for (const event of events) {
    if (event.status === "cancelled") continue;

    const eventId = event.id;
    const masterId = event.recurringEventId || event.id;
    const fields = mapEventToTaskFields(event);
    if (!fields.fecha) continue;

    // ¿Ya existe una tarea con EXACTAMENTE este evento? → la actualizamos.
    const existing = await Task.findOne({ user: userId, googleEventId: eventId });

    if (existing) {
      existing.meta = fields.meta;
      existing.contenido = fields.contenido;
      existing.fecha = fields.fecha;
      existing.horario = fields.horario;
      await existing.save();
      updated += 1;
      continue;
    }

    // Si es una instancia de un evento recurrente que NOSOTROS creamos desde la web,
    // la salteamos para no duplicar (su "master" ya está vinculado a una tarea).
    if (event.recurringEventId) {
      const ownsMaster = await Task.exists({ user: userId, googleEventId: masterId });
      if (ownsMaster) continue;
    }

    // Evento nuevo nacido en Google → lo creamos como tarea.
    if (created >= MAX_NEW_PER_SYNC) {
      capped += 1;
      continue;
    }

    try {
      await Task.create({
        user: userId,
        workspace,
        meta: fields.meta,
        tipo: "task",
        contenido: fields.contenido,
        fecha: fields.fecha,
        horario: fields.horario,
        googleEventId: eventId,
      });
      created += 1;
    } catch (err) {
      // 11000 = clave duplicada: otra sincronización en paralelo ya lo creó. Lo ignoramos.
      if (err?.code !== 11000) throw err;
    }
  }

  if (capped > 0) {
    console.warn(
      `pullEventsFromGoogle: se alcanzó el límite de ${MAX_NEW_PER_SYNC} tareas nuevas; ${capped} eventos quedaron sin importar este ciclo.`
    );
  }

  return { connected: true, created, updated, capped, total: events.length };
};

// Borra el evento vinculado en Google Calendar (si existe).
export const deleteTaskFromGoogle = async (userId, task) => {
  try {
    if (!task?.googleEventId) return;

    const user = await loadUserWithTokens(userId);
    if (!user?.google?.connected || !user.google?.refreshToken) return;

    const calendar = getCalendarForUser(user);
    await calendar.events.delete({
      calendarId: "primary",
      eventId: task.googleEventId,
    });
  } catch (error) {
    // Si el evento ya no existe (410/404) o cualquier otra cosa, no rompemos el borrado.
    console.warn("deleteTaskFromGoogle falló (la tarea se borró igual):", error.message);
  }
};
