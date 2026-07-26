import * as SecureStore from "expo-secure-store";

// Configuración de notificaciones del usuario (local, sin servidor).
// Pensada para ir sumando switches (más avisos) sin cambiar el resto.
const KEY = "notif-settings-v1";

export const NOTIF_DEFAULTS = {
  avisarAntesTarea: false, // switch: avisar antes de una tarea
  minutosAntes: 10, // cuántos minutos antes
};

export const loadNotifSettings = async () => {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return { ...NOTIF_DEFAULTS };
    return { ...NOTIF_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...NOTIF_DEFAULTS };
  }
};

export const saveNotifSettings = async (settings) => {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(settings));
  } catch {
    // silencioso: si no se puede guardar, no rompemos la app
  }
};
