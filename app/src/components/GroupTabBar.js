// GroupTabBar — barra inferior plana del rediseño: muestra TODAS las secciones
// del grupo activo (las que antes vivían en el dial radial). El grupo llega por
// prop desde MainTabs según la card elegida en el Lobby.
// Sigue el tema claro/oscuro de la app.
import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NAV_GROUPS } from "./RadialTabBar";
import { useTheme } from "../theme";

const VERDE = "#75f94c";

export default function GroupTabBar({ state, navigation, groupId }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  // Colores según tema: oscuro mantiene el look del rediseño; claro va en blanco
  const barBg = isDark ? "#071821" : colors.card;
  const barBorder = isDark ? "rgba(255,255,255,0.16)" : colors.cardBorder;
  const tintOn = isDark ? VERDE : colors.greenDark;
  const tintOff = isDark ? "rgba(255,255,255,0.55)" : colors.muted;
  const group = NAV_GROUPS.find((g) => g.id === groupId) || NAV_GROUPS[0];

  // Ítem resaltado: el último tocado. La ruta sola no alcanza porque un grupo
  // puede repetirla con distintos params (Notas / Journaling / Afirmaciones).
  const currentRoute = state.routes[state.index]?.name;
  const [pressed, setPressed] = useState(null);
  const activeIdx = (() => {
    if (pressed != null && group.items[pressed]?.route === currentRoute) return pressed;
    const i = group.items.findIndex((it) => it.route === currentRoute);
    return i >= 0 ? i : 0;
  })();

  // Mismo recorte de safe-area que usaba el dial: holgura mínima sobre el home-indicator.
  const barPad = Math.max(insets.bottom - 12, 6);

  return (
    <View style={[styles.bar, { paddingBottom: barPad, backgroundColor: barBg, borderTopColor: barBorder }]}>
      {group.items.map((it, i) => {
        const active = i === activeIdx;
        const tint = active ? tintOn : tintOff;
        return (
          <Pressable
            key={it.label}
            style={styles.tab}
            onPress={() => {
              setPressed(i);
              navigation.navigate(it.route, { ...(it.params || {}), _navTs: Date.now() });
            }}
          >
            <Ionicons name={it.icon} size={22} color={tint} />
            <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 7,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  label: { fontSize: 10.5, fontWeight: "700" },
});
