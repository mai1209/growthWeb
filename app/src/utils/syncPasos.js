// Sincroniza los pasos del teléfono con el servidor al abrir la app y cada vez
// que vuelve al frente, desde CUALQUIER pantalla. Antes solo pasaba con la
// pantalla Movilidad abierta, así que la web quedaba en 0 si no entrabas ahí.
// Nunca pide permisos: si no están dados, no hace nada (Movilidad los pide).
import { AppState, Platform } from "react-native";
import { Pedometer } from "expo-sensors";
import { saludService } from "../api";
import {
  pasosAndroidDisponible,
  pasosAndroidPermitido,
  pasosHoyAndroid,
  pasosSemanaAndroid,
} from "../services/pasosAndroid";

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

const MIN_INTERVALO = 2 * 60 * 1000; // no más de una sync cada 2 min
let ultimaSync = 0;

async function leerPasosIOS() {
  const disponible = await Pedometer.isAvailableAsync().catch(() => false);
  if (!disponible) return null;
  // Solo si el permiso de Movimiento ya está dado: no queremos el cartel acá.
  const perm = await Pedometer.getPermissionsAsync().catch(() => null);
  if (perm && perm.granted === false) return null;
  const ahora = new Date();
  const pasos = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(ahora);
    d.setDate(d.getDate() - i);
    const ini = startOfDay(d);
    const fin = i === 0 ? ahora : new Date(ini.getTime() + 86399999);
    try {
      const r = await Pedometer.getStepCountAsync(ini, fin);
      pasos[dayKey(d)] = r?.steps ?? 0;
    } catch {
      /* un día que falla no frena el resto */
    }
  }
  return pasos;
}

async function leerPasosAndroid() {
  if (!pasosAndroidDisponible) return null;
  if (!(await pasosAndroidPermitido())) return null;
  const semana = (await pasosSemanaAndroid().catch(() => ({}))) || {};
  const hoyPasos = await pasosHoyAndroid().catch(() => 0);
  const k = dayKey(new Date());
  if (hoyPasos > (Number(semana[k]) || 0)) semana[k] = hoyPasos;
  return semana;
}

export async function sincronizarPasos({ forzar = false } = {}) {
  const ahora = Date.now();
  if (!forzar && ahora - ultimaSync < MIN_INTERVALO) return false;
  ultimaSync = ahora;
  try {
    const pasos = Platform.OS === "android" ? await leerPasosAndroid() : await leerPasosIOS();
    if (!pasos) return false;
    // Solo días con pasos: el servidor guarda el MÁXIMO por día, así nunca baja
    // y un 0 de lectura nunca pisa un valor real.
    const conDatos = {};
    Object.keys(pasos).forEach((k) => {
      if ((Number(pasos[k]) || 0) > 0) conDatos[k] = pasos[k];
    });
    if (!Object.keys(conDatos).length) return false;
    await saludService.update({ pasos: conDatos });
    return true;
  } catch {
    return false;
  }
}

// Al abrir la app (logueado) y cada vez que vuelve al frente.
export function iniciarSyncPasos() {
  sincronizarPasos({ forzar: true });
  const sub = AppState.addEventListener("change", (estado) => {
    if (estado === "active") sincronizarPasos();
  });
  return () => sub.remove();
}
