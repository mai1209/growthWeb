// Puente JS con el widget de tareas de home screen.
// - iOS: módulo nativo NotasWidgetModule -> App Group -> widget WidgetKit.
// - Android: AsyncStorage -> react-native-android-widget (RemoteViews).
// Escribe las tareas pendientes de hoy (máx 7) y refresca el widget. Si nada
// está disponible (Expo Go, build sin widget), degrada a no-op.
import { NativeModules, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { NotasWidgetModule } = NativeModules;
const WIDGET_STORAGE_KEY = "widget_tareas";

// tareas: array de { titulo, hora, color }. Se recorta a 7 (lo que muestra el widget).
export function guardarTareasWidget(tareas) {
  const items = (tareas || []).slice(0, 7).map((t) => ({
    titulo: String(t?.titulo || "").slice(0, 80),
    hora: String(t?.hora || "").slice(0, 12),
    color: String(t?.color || "").slice(0, 9),
    // `texto` va por compatibilidad con la versión anterior del widget iOS que
    // pueda quedar cacheada (su decode requería ese campo).
    texto: "",
  }));

  if (Platform.OS === "ios") {
    if (!NotasWidgetModule) return;
    try {
      NotasWidgetModule.setNotas(JSON.stringify(items));
    } catch {}
    return;
  }

  if (Platform.OS === "android") {
    AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(items)).catch(() => {});
    try {
      const { requestWidgetUpdate } = require("react-native-android-widget");
      const React = require("react");
      const { TareasWidget } = require("../../widgets/TareasWidget");
      requestWidgetUpdate({
        widgetName: "Tareas",
        renderWidget: () => React.createElement(TareasWidget, { tareas: items }),
        widgetNotFound: () => {},
      });
    } catch {}
  }
}
