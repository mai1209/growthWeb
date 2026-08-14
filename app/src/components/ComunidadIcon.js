// Ícono de Comunidad. Por ahora el globo (mundo), reconocible y prolijo.
// Cuando tengamos el SVG propio de Figma (un solo color) se cambia acá nomás.
import React from "react";
import { Ionicons } from "@expo/vector-icons";

export default function ComunidadIcon({ size = 22, color = "#000" }) {
  return <Ionicons name="globe-outline" size={size} color={color} />;
}
