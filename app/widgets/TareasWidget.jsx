// Widget de home screen (Android) con las tareas pendientes de hoy.
// Espeja el widget de iOS (NotasWidget): mismo dato { titulo, hora, color }.
// La UI se declara con los componentes de react-native-android-widget, que el
// nativo convierte a RemoteViews.
import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";

const BG = "#0d2831"; // fondo oscuro, como la app
const TEXT = "#eaf4f0";
const MUTED = "#8fb0a8";
const GREEN = "#6abf71";

const MAX = 6; // cuántas tareas entran cómodas

export function TareasWidget({ tareas = [] }) {
  const lista = Array.isArray(tareas) ? tareas : [];
  const items = lista.slice(0, MAX);
  const restantes = Math.max(0, lista.length - items.length);

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        flexDirection: "column",
        backgroundColor: BG,
        borderRadius: 20,
        padding: 14,
      }}
    >
      <FlexWidget
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
      >
        <TextWidget
          text="Tareas de hoy"
          style={{ fontSize: 14, fontFamily: "sans-serif-medium", color: TEXT }}
        />
      </FlexWidget>

      {items.length === 0 ? (
        <TextWidget
          text="Sin pendientes 🎉"
          style={{ fontSize: 13, color: MUTED }}
        />
      ) : (
        items.map((t, i) => (
          <FlexWidget
            key={`t${i}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 6,
              width: "match_parent",
            }}
          >
            <FlexWidget
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: t.color || GREEN,
                marginRight: 8,
              }}
            />
            <FlexWidget style={{ flex: 1 }}>
              <TextWidget
                text={t.titulo || "Tarea"}
                maxLines={1}
                style={{ fontSize: 13, color: TEXT }}
              />
            </FlexWidget>
            {t.hora ? (
              <TextWidget
                text={t.hora}
                style={{ fontSize: 12, color: MUTED, marginLeft: 6 }}
              />
            ) : null}
          </FlexWidget>
        ))
      )}

      {restantes > 0 ? (
        <TextWidget
          text={`+${restantes} más`}
          style={{ fontSize: 12, color: GREEN, marginTop: 2 }}
        />
      ) : null}
    </FlexWidget>
  );
}
