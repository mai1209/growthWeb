import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Animated,
  PanResponder,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";

// Grupos del menú, calcados de la navegación de la web (Nav.jsx).
// `route` es el nombre del Tab.Screen; `params` abre un sub-panel dentro de esa pantalla.
export const NAV_GROUPS = [
  {
    id: "finanzas",
    label: "Finanzas",
    short: "Finanzas",
    icon: "wallet-outline",
    items: [
      { label: "Home", icon: "home-outline", route: "Home" },
      { label: "Filtros", icon: "filter-outline", route: "Filtros" },
      { label: "Métricas", icon: "stats-chart-outline", route: "Metricas" },
      { label: "Compartidos", icon: "people-outline", route: "Compartidos" },
      { label: "Compras", icon: "cart-outline", route: "Notas", params: { view: "shopping" } },
    ],
  },
  {
    id: "desarrollo",
    label: "Desar. personal",
    short: "Desarrollo",
    icon: "trending-up-outline",
    items: [
      { label: "Metas", icon: "flag-outline", route: "Metas" },
      { label: "Tareas", icon: "checkbox-outline", route: "Tareas" },
      { label: "Notas", icon: "document-text-outline", route: "Notas" },
      { label: "Journaling", icon: "book-outline", route: "Notas", params: { view: "journal" } },
      { label: "Afirmac.", icon: "sunny-outline", route: "Notas", params: { view: "afirmaciones" } },
      { label: "Pomodoro", icon: "timer-outline", route: "Pomodoro", params: { panel: "pomodoro" } },
    ],
  },
  {
    id: "coworking",
    label: "Co-working",
    short: "Co-working",
    icon: "people-circle-outline",
    items: [
      { label: "Registro", icon: "time-outline", route: "Pomodoro", params: { panel: "tracker" } },
    ],
  },
];

const R = 128; // radio del arco
const ITEM = 60; // diámetro de cada ícono del dial
const BAR_H = 46; // alto de la barra (sin el safe-area de abajo)
const MAX_ITEMS = 6; // grupo más grande (Desar. personal)
const ROT_LIMIT = 55; // tope de rotación al arrastrar (grados)

// Ángulos del arco superior (270° = arriba, centrado) según cuántos ítems haya.
function itemAngles(n) {
  if (n <= 1) return [270];
  const span = Math.min(160, (n - 1) * 36);
  const start = 270 - span / 2;
  const step = span / (n - 1);
  return Array.from({ length: n }, (_, k) => start + step * k);
}

export default function RadialTabBar({ state, navigation }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [activeGroup, setActiveGroup] = useState(null);
  const open = activeGroup != null;
  const group = open ? NAV_GROUPS[activeGroup] : null;

  // Grupo resaltado en la barra. No se puede deducir solo por la ruta: hay rutas
  // compartidas entre grupos (Pomodoro está en Desarrollo y Co-working; Notas en
  // Finanzas y Desarrollo). Recordamos desde qué grupo se navegó.
  const [selectedGroup, setSelectedGroup] = useState(() => {
    const r = state.routes[state.index]?.name;
    const idx = NAV_GROUPS.findIndex((g) => g.items.some((it) => it.route === r));
    return idx >= 0 ? idx : 0;
  });

  const bgProg = useRef(new Animated.Value(0)).current; // fondo vidrio (0→1), se mantiene al cambiar de grupo
  const rot = useRef(new Animated.Value(0)).current; // rotación del arco (grados)
  const committedRot = useRef(0); // rotación acumulada entre arrastres
  const itemAnims = useRef(
    Array.from({ length: MAX_ITEMS }, () => new Animated.Value(0))
  ).current;

  // Padding inferior recortado: deja apenas holgura sobre el home-indicator y pega los íconos abajo.
  const barPad = Math.max(insets.bottom - 12, 6);
  const cx = width / 2;
  const cy = height - barPad - BAR_H - 30; // centro del arco, apenas sobre la barra

  const runItems = (i) => {
    committedRot.current = 0;
    rot.setValue(0);
    itemAnims.forEach((v) => v.setValue(0));
    const n = NAV_GROUPS[i].items.length;
    Animated.stagger(
      45,
      itemAnims.slice(0, n).map((v) =>
        Animated.spring(v, { toValue: 1, useNativeDriver: false, friction: 6, tension: 80 })
      )
    ).start();
  };

  const openGroup = (i) => {
    setActiveGroup(i);
    bgProg.setValue(0);
    Animated.spring(bgProg, { toValue: 1, useNativeDriver: false, friction: 8, tension: 70 }).start();
    runItems(i);
  };

  const switchGroup = (i) => {
    setActiveGroup(i);
    runItems(i);
  };

  const close = (after) => {
    Animated.timing(bgProg, { toValue: 0, duration: 160, useNativeDriver: false }).start(() => {
      setActiveGroup(null);
      if (after) after();
    });
    itemAnims.forEach((v) =>
      Animated.timing(v, { toValue: 0, duration: 120, useNativeDriver: false }).start()
    );
  };

  const go = (item) => {
    setSelectedGroup(activeGroup); // el grupo desde el que se eligió queda resaltado
    const target = item.route;
    const params = { ...(item.params || {}), _navTs: Date.now() };
    // Cerramos el dial y navegamos recién cuando su Modal se desmontó: si navegáramos
    // en el acto, iOS descartaría la presentación del panel destino (dos Modales a la vez).
    close(() => setTimeout(() => navigation.navigate(target, params), 60));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Solo tomamos el gesto si es un arrastre horizontal claro (los taps pasan a los íconos).
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => {
        const next = Math.max(-ROT_LIMIT, Math.min(ROT_LIMIT, committedRot.current + g.dx * 0.3));
        rot.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        committedRot.current = Math.max(
          -ROT_LIMIT,
          Math.min(ROT_LIMIT, committedRot.current + g.dx * 0.3)
        );
      },
    })
  ).current;

  const rotDeg = rot.interpolate({ inputRange: [-360, 360], outputRange: ["-360deg", "360deg"] });
  const counterDeg = rot.interpolate({ inputRange: [-360, 360], outputRange: ["360deg", "-360deg"] });

  const positioned = group
    ? group.items.map((it, k) => {
        const angs = itemAngles(group.items.length);
        const a = (angs[k] * Math.PI) / 180;
        return {
          ...it,
          left: R + R * Math.cos(a) - ITEM / 2,
          top: R + R * Math.sin(a) - ITEM / 2,
        };
      })
    : [];

  // La barra queda igual (visible sobre el blur); solo el ícono del grupo activo se pinta verde.
  const renderBar = (opened) => (
    <View
      style={[styles.bar, { paddingBottom: barPad, height: BAR_H + barPad }]}
    >
      {NAV_GROUPS.map((g, i) => {
        const active = opened ? activeGroup === i : selectedGroup === i;
        const tint = active ? colors.greenBright : colors.muted;
        return (
          <Pressable
            key={g.id}
            style={styles.tab}
            onPress={() => {
              if (!opened) openGroup(i);
              else if (activeGroup === i) close();
              else switchGroup(i);
            }}
          >
            <Ionicons name={g.icon} size={23} color={tint} />
            <Text style={[styles.tabLabel, { color: tint }]} numberOfLines={1}>
              {g.short}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <>
      {renderBar(false)}

      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => close()}
      >
        <View style={{ flex: 1 }}>
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { opacity: bgProg }]}
          >
            <BlurView
              intensity={25}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.greenSoft }]} />
          </Animated.View>

          <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} />

          {group && (
            <Animated.View
              {...pan.panHandlers}
              style={[styles.arcLayer, { left: cx - R, top: cy - R, transform: [{ rotate: rotDeg }] }]}
            >
              {positioned.map((it, k) => (
                <Animated.View
                  key={`${it.label}-${k}`}
                  style={[
                    styles.itemWrap,
                    {
                      left: it.left,
                      top: it.top,
                      opacity: itemAnims[k],
                      transform: [{ scale: itemAnims[k] }, { rotate: counterDeg }],
                    },
                  ]}
                >
                  <Pressable style={styles.item} onPress={() => go(it)}>
                    <Ionicons name={it.icon} size={22} color={colors.text} />
                    <Text style={styles.itemLabel} numberOfLines={1}>
                      {it.label}
                    </Text>
                  </Pressable>
                </Animated.View>
              ))}
            </Animated.View>
          )}

          <View style={styles.barDock}>{renderBar(true)}</View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    bar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      backgroundColor: colors.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.cardBorder,
    },
    barDock: { position: "absolute", left: 0, right: 0, bottom: 0 },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingVertical: 3,
    },
    tabLabel: { fontSize: 11, fontWeight: "700" },
    arcLayer: { position: "absolute", width: R * 2, height: R * 2 },
    itemWrap: { position: "absolute", width: ITEM, height: ITEM },
    item: {
      width: ITEM,
      height: ITEM,
      borderRadius: ITEM / 2,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.greenBright,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    itemLabel: { fontSize: 9, fontWeight: "600", color: colors.muted, maxWidth: ITEM - 6 },
  });
