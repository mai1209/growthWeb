// Handler headless del widget de Android. Android lo invoca al agregar,
// actualizar o redimensionar el widget (incluso con la app cerrada). Lee las
// tareas que la app dejó guardadas en AsyncStorage y las dibuja.
// El click abre la app: se maneja nativo con clickAction="OPEN_APP".
import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TareasWidget } from "./widgets/TareasWidget";

export const WIDGET_STORAGE_KEY = "widget_tareas";

export async function widgetTaskHandler(props) {
  let tareas = [];
  try {
    const raw = await AsyncStorage.getItem(WIDGET_STORAGE_KEY);
    if (raw) tareas = JSON.parse(raw);
  } catch {}

  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED":
      props.renderWidget(<TareasWidget tareas={tareas} />);
      break;
    default:
      break;
  }
}
