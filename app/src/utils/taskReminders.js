import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import {
  filterTasksForDate,
  isTaskCompletedOnDate,
  getIsoDate,
  addDays,
  startOfDay,
} from "./tasks";

// Recordatorios locales de tareas: "avisame X minutos antes".
// Programa notificaciones locales (sin servidor) para las próximas ocurrencias
// de cada tarea con hora, disparando `minutosAntes` antes del horario.

const PREFIX = "task-reminder-";
const CHANNEL_ID = "tareas-v1";
const DAYS_AHEAD = 7; // cuántos días hacia adelante agendamos
const MAX_NOTIFS = 60; // iOS limita ~64 notificaciones pendientes

// Cómo se muestra si llega con la app abierta.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const asegurarCanal = async () => {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Recordatorios de tareas",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
  });
};

const pad = (n) => String(n).padStart(2, "0");

const parseHora = (horario) => {
  const [hh, mm] = String(horario || "")
    .split(":")
    .map((x) => Number(x));
  if (!Number.isFinite(hh)) return null;
  return { hour: hh, minute: Number.isFinite(mm) ? mm : 0 };
};

const horaTexto = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

// Cancela sólo las notificaciones nuestras (por prefijo de identifier), así no
// pisamos las de afirmaciones ni ninguna otra.
const cancelarPrevias = async () => {
  try {
    const todas = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      todas
        .filter((n) => String(n.identifier || "").startsWith(PREFIX))
        .map((n) =>
          Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})
        )
    );
  } catch {
    // ignorar
  }
};

/**
 * Reprograma todos los recordatorios de tareas según la config actual.
 * @param {Array} tasks  todas las tareas del usuario (tipo task)
 * @param {{avisarAntesTarea:boolean, minutosAntes:number}} settings
 */
export const syncTaskReminders = async (tasks = [], settings = {}) => {
  try {
    await cancelarPrevias();

    if (!settings.avisarAntesTarea) return true;

    const minsRaw = Number(settings.minutosAntes);
    const minutos = Number.isFinite(minsRaw) && minsRaw >= 0 ? minsRaw : 10;

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return false;

    await asegurarCanal();

    const now = new Date();
    const base = startOfDay(now);
    const aAgendar = [];

    for (let d = 0; d < DAYS_AHEAD; d += 1) {
      const dia = addDays(base, d);
      const isoDia = getIsoDate(dia);
      const visibles = filterTasksForDate(tasks, dia);
      for (const t of visibles) {
        const hora = parseHora(t.horario);
        if (!hora) continue; // sin hora no podemos avisar "antes"
        if (isTaskCompletedOnDate(t, dia)) continue; // ya hecha ese día
        const cuando = new Date(dia);
        cuando.setHours(hora.hour, hora.minute, 0, 0);
        const disparo = new Date(cuando.getTime() - minutos * 60000);
        if (disparo <= now) continue; // el aviso ya pasó
        aAgendar.push({ t, isoDia, cuando, disparo });
      }
    }

    aAgendar.sort((a, b) => a.disparo - b.disparo);
    const lote = aAgendar.slice(0, MAX_NOTIFS);

    await Promise.all(
      lote.map(({ t, isoDia, cuando, disparo }, i) =>
        Notifications.scheduleNotificationAsync({
          identifier: `${PREFIX}${t._id}-${isoDia}-${i}`,
          content: {
            title: "Tenés una tarea pronto",
            body: `${t.meta || "Tarea"} · ${horaTexto(cuando)}`,
            sound: "default",
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: disparo,
            channelId: Platform.OS === "android" ? CHANNEL_ID : undefined,
          },
        }).catch(() => {})
      )
    );
    return true;
  } catch {
    return false;
  }
};
