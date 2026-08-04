// Lectura de pasos en Android vía Health Connect (el sistema de salud de Android,
// que ya lleva la cuenta de pasos del teléfono en segundo plano). iOS no usa esto.
// Si algo falla o no está disponible, todo degrada a 0 / no rompe.
import { Platform } from "react-native";

let HC = null;
if (Platform.OS === "android") {
  try {
    HC = require("react-native-health-connect");
  } catch {
    HC = null;
  }
}

export const healthConnectDisponible = Platform.OS === "android" && !!HC;

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

let inicializado = false;

// Inicializa el cliente y pide permiso de lectura de pasos. Devuelve true si quedó ok.
export async function iniciarHealthConnect() {
  if (!HC) return false;
  try {
    if (!inicializado) inicializado = await HC.initialize();
    if (!inicializado) return false;
    const granted = await HC.getGrantedPermissions();
    const tiene = (granted || []).some((p) => p.recordType === "Steps" && p.accessType === "read");
    if (tiene) return true;
    const res = await HC.requestPermission([{ accessType: "read", recordType: "Steps" }]);
    return (res || []).some((p) => p.recordType === "Steps" && p.accessType === "read");
  } catch {
    return false;
  }
}

async function pasosEntre(inicio, fin) {
  if (!HC) return 0;
  try {
    const res = await HC.readRecords("Steps", {
      timeRangeFilter: { operator: "between", startTime: inicio.toISOString(), endTime: fin.toISOString() },
    });
    const records = res?.records || res || [];
    return records.reduce((a, r) => a + (Number(r.count) || 0), 0);
  } catch {
    return 0;
  }
}

// Pasos de hoy (número).
export async function pasosHoyHC() {
  const ahora = new Date();
  return pasosEntre(startOfDay(ahora), ahora);
}

// Últimos 7 días → { "YYYY-MM-DD": pasos }.
export async function pasosSemanaHC() {
  const ahora = new Date();
  const out = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(ahora);
    d.setDate(d.getDate() - i);
    const ini = startOfDay(d);
    const fin = i === 0 ? ahora : new Date(ini.getTime() + 86399999);
    out[dayKey(d)] = await pasosEntre(ini, fin);
  }
  return out;
}
