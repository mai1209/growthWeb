import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Recordatorio diario de afirmaciones con notificación LOCAL (sin servidor).

const REMINDER_ID = "afirmaciones-reminder";
// Una notificación semanal por día de la semana (1=domingo ... 7=sábado),
// cada una con su propio título: así el título varía entre días.
const WEEKDAY_IDS = [1, 2, 3, 4, 5, 6, 7].map((d) => `${REMINDER_ID}-${d}`);
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

// Títulos estoicos: cada día de la semana recibe uno sorteado al programar.
const TITULOS = [
  "Tu carácter se entrena",
  "La disciplina no descansa",
  "Lo que repetís, sos",
  "Forjá tu día",
  "Nadie lo hace por vos",
  "Hoy se templa el acero",
];

// Mezcla los títulos y reparte uno por día de la semana. Son 7 días y 6
// títulos, así que uno se repite: al 7º día le toca el del medio de la bolsa,
// que nunca queda pegado ni al día 6 ni al día 1 (sábado→domingo son
// consecutivos en la vida real).
const titulosSemana = () => {
  const bolsa = [...TITULOS];
  for (let i = bolsa.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [bolsa[i], bolsa[j]] = [bolsa[j], bolsa[i]];
  }
  return [...bolsa, bolsa[3]];
};

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
    // Cancela la diaria vieja y las 7 semanales antes de reprogramar.
    await Promise.all(
      [REMINDER_ID, ...WEEKDAY_IDS].map((id) =>
        Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
      )
    );
    if (!activo) return true;

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return false;

    await asegurarCanal();

    const [hh, mm] = String(hora || "08:00").split(":").map(Number);
    const hour = Number.isFinite(hh) ? hh : 8;
    const minute = Number.isFinite(mm) ? mm : 0;
    const body = mensajeDe({ lineas, repetirDiario });
    const titulos = titulosSemana();

    // Una notificación semanal por día (weekday 1=domingo ... 7=sábado),
    // cada una con su título sorteado.
    await Promise.all(
      WEEKDAY_IDS.map((id, i) =>
        Notifications.scheduleNotificationAsync({
          identifier: id,
          content: {
            title: titulos[i],
            body,
            sound: "default",
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: i + 1,
            hour,
            minute,
            channelId: Platform.OS === "android" ? CHANNEL_ID : undefined,
          },
        })
      )
    );
    return true;
  } catch {
    return false;
  }
};
