// Puente JS con el módulo nativo LiveActivityModule (Live Activity de la caminata).
// Si el módulo no está (Expo Go, Android, o build sin la extensión), degrada a no-op.
import { NativeModules, Platform } from "react-native";

const { LiveActivityModule } = NativeModules;
const disponible = Platform.OS === "ios" && !!LiveActivityModule;

export function iniciarCaminataLA(metros, segundos) {
  if (!disponible) return;
  try {
    LiveActivityModule.start(metros || 0, segundos || 0);
  } catch {}
}

export function actualizarCaminataLA(metros, segundos) {
  if (!disponible) return;
  try {
    LiveActivityModule.update(metros || 0, segundos || 0);
  } catch {}
}

export function terminarCaminataLA() {
  if (!disponible) return;
  try {
    LiveActivityModule.end();
  } catch {}
}
