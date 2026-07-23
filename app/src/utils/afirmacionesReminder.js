import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Recordatorio diario de afirmaciones con notificación LOCAL (sin servidor).

const REMINDER_ID = "afirmaciones-reminder";
// v2: los canales de Android son inmutables una vez creados; al cambiar el
// sonido hay que crear un canal nuevo para que aplique.
const CHANNEL_ID = "afirmaciones-v2";

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
    name: "Afirmaciones diarias",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
  });
};

const TITULO = "Tus afirmaciones de hoy";

// Mensaje corto y estoico. El verbo depende de si a esa hora va a haber
// afirmaciones escritas: con "guardar al día siguiente" prendido y renglones
// escritos, se leen; si el día arranca vacío, se escriben.
const mensajeDe = ({ lineas, repetirDiario }) => {
  const hayEscritas = (lineas || []).some((l) => String(l || "").trim());
  const seLeen = repetirDiario !== false && hayEscritas;
  return seLeen
    ? "Tu mente se tiñe de tus pensamientos: leé tus afirmaciones."
    : "Tu mente se tiñe de tus pensamientos: escribí tus afirmaciones de hoy.";
};

// Sincroniza el recordatorio: cancela el anterior y, si está activo,
// programa la notificación diaria a la hora elegida. Llamalo al abrir el
// panel y ante cualquier cambio de configuración.
export const syncAfirmacionesReminder = async ({ activo, hora, lineas, repetirDiario }) => {
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
        body: mensajeDe({ lineas, repetirDiario }),
        sound: "default",
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
