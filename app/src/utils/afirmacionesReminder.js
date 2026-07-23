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

// Elige la afirmación del día: rota entre las escritas según la fecha.
const afirmacionDelDia = (lineas) => {
  const escritas = (lineas || []).map((l) => String(l || "").trim()).filter(Boolean);
  if (!escritas.length) return "Tomate un minuto para leer tus afirmaciones.";
  const dia = Math.floor(Date.now() / 86400000); // días desde epoch, alcanza para rotar
  return escritas[dia % escritas.length];
};

// Sincroniza el recordatorio: cancela el anterior y, si está activo,
// programa la notificación diaria a la hora elegida con la afirmación del día.
// Llamalo al abrir el panel y al cambiar la configuración: así el texto rota.
export const syncAfirmacionesReminder = async ({ activo, hora, lineas }) => {
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
        title: "Tus afirmaciones de hoy ✨",
        body: afirmacionDelDia(lineas),
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
