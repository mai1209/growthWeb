// Puente JS con el módulo nativo NotasWidgetModule (widget de tareas en iOS).
// Escribe las tareas pendientes de hoy al App Group compartido para que el
// widget de home screen las muestre. Si el módulo no está (Android, Expo Go, o
// build sin la extensión / sin App Group), degrada a no-op.
import { NativeModules, Platform } from "react-native";

const { NotasWidgetModule } = NativeModules;
const disponible = Platform.OS === "ios" && !!NotasWidgetModule;

// tareas: array de { titulo, hora }. Se recorta a 7 (lo que muestra el widget).
export function guardarTareasWidget(tareas) {
  if (!disponible) return;
  try {
    const items = (tareas || []).slice(0, 7).map((t) => ({
      titulo: String(t?.titulo || "").slice(0, 80),
      hora: String(t?.hora || "").slice(0, 12),
    }));
    NotasWidgetModule.setNotas(JSON.stringify(items));
  } catch {}
}
