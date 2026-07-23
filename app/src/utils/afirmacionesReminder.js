import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Recordatorio diario de afirmaciones con notificación LOCAL (sin servidor).
// La notificación trae una de tus afirmaciones en el cuerpo, rotando por día.

const REMINDER_ID = "afirmaciones-reminder";
const CHANNEL_ID = "afirmaciones";

// Cómo se muestra si llega con la app abierta.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const asegurarCanal = async () => {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Afirmaciones diarias",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
};

// Mensaje fijo del recordatorio, con espíritu estoico: la repetición diaria
// es lo que convierte las palabras en carácter.
const TITULO = "Tus afirmaciones de hoy";
const MENSAJE =
  "Tu mente se tiñe del color de tus pensamientos. Repetilos cada día y se vuelven carácter: leé tus afirmaciones.";

// Sincroniza el recordatorio: cancela el anterior y, si está activo,
// programa la notificación diaria a la hora elegida.
export const syncAfirmacionesReminder = async ({ activo, hora }) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
    if (!activo) return true;

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return false;

    await asegurarCanal();

    const [hh, mm] = String(hora || "08:00").split(":").map(Number);
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: {
        title: TITULO,
        body: MENSAJE,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: Number.isFinite(hh) ? hh : 8,
        minute: Number.isFinite(mm) ? mm : 0,
        channelId: Platform.OS === "android" ? CHANNEL_ID : undefined,
      },
    });
    return true;
  } catch {
    return false;
  }
};
