// Lectura de pasos en Android desde el SENSOR de pasos del teléfono (hardware),
// vía expo-android-pedometer. A diferencia de Health Connect (que es un "cuaderno
// compartido" que puede estar vacío), esto lee el contador real del celu y cuenta
// en segundo plano con un servicio + notificación fija (como Google Fit).
// iOS NO usa esto (sigue con expo-sensors / CoreMotion). Todo degrada a 0 si falla.
import { Platform } from "react-native";

let AP = null;
if (Platform.OS === "android") {
  try {
    AP = require("expo-android-pedometer");
  } catch {
    AP = null;
  }
}

export const pasosAndroidDisponible = Platform.OS === "android" && !!AP;

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

let listo = false;

// Inicializa el sensor, pide permisos (actividad + notificaciones) y arranca el
// servicio en segundo plano con la notificación. Devuelve true si quedó ok.
export async function iniciarPasosAndroid() {
  if (!AP) return false;
  try {
    await AP.isSensorAvailable(); // lanza si el teléfono no tiene sensor de pasos
    const act = await AP.getActivityPermissionStatus();
    if (!act?.granted) {
      const r = await AP.requestActivityPermissions();
      if (!r?.granted) return false;
    }
    const noti = await AP.getNotificationPermissionStatus();
    if (!noti?.granted) {
      await AP.requestNotificationPermissions(); // si la deniega, igual cuenta; solo no se ve la notif
    }
    await AP.setupBackgroundUpdates({
      title: "Growth · Pasos",
      contentTemplate: "Llevás %d pasos hoy",
    });
    listo = true;
    return true;
  } catch {
    return false;
  }
}

// Pasos de hoy (número).
export async function pasosHoyAndroid() {
  if (!AP) return 0;
  try {
    return Number(await AP.getStepsCountAsync()) || 0;
  } catch {
    return 0;
  }
}

// Últimos 7 días → { "YYYY-MM-DD": pasos }.
export async function pasosSemanaAndroid() {
  if (!AP) return {};
  const out = {};
  const ahora = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(ahora);
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    try {
      out[k] = Number(await AP.getStepsCountAsync(k)) || 0;
    } catch {
      out[k] = 0;
    }
  }
  return out;
}
