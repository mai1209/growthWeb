// Puente JS con el módulo nativo NotasWidgetModule (widget de notas en iOS).
// Escribe las notas más recientes al App Group compartido para que el widget
// de home screen las muestre. Si el módulo no está (Android, Expo Go, o build
// sin la extensión / sin App Group), degrada a no-op.
import { NativeModules, Platform } from "react-native";

const { NotasWidgetModule } = NativeModules;
const disponible = Platform.OS === "ios" && !!NotasWidgetModule;

// notas: array de { titulo, texto }. Se recorta a 3 (lo que muestra el widget).
export function guardarNotasWidget(notas) {
  if (!disponible) return;
  try {
    const items = (notas || []).slice(0, 3).map((n) => ({
      titulo: String(n?.titulo || "").slice(0, 60),
      texto: String(n?.texto || "").slice(0, 140),
    }));
    NotasWidgetModule.setNotas(JSON.stringify(items));
  } catch {}
}
