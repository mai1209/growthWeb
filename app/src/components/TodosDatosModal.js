import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (key, delta) => {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
};
const fechaLabel = (key, hoy) => {
  if (key === hoy) return "Hoy";
  if (key === addDays(hoy, -1)) return "Ayer";
  return new Date(`${key}T00:00:00`).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
};
const ANIMO_EMOJI = { 1: "😔", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };

// Mini gráfico de barras (estilo Salud de iPhone): la última barra va acentuada.
function MiniBars({ valores, color, track }) {
  const max = Math.max(...valores, 1);
  return (
    <View style={ui.bars}>
      {valores.map((v, i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: Math.max(3, Math.round((v / max) * 44)),
            borderRadius: 3,
            backgroundColor: i === valores.length - 1 && v > 0 ? color : track,
          }}
        />
      ))}
    </View>
  );
}

export default function TodosDatosModal({
  visible,
  onClose,
  pasosHist,
  aguaDias,
  animoDias,
  pesoDias,
  comidasDias,
  caminatas,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const hoyReal = dayKey(new Date());
  const [fecha, setFecha] = useState(hoyReal);
  // Al abrir el modal, arranca en el día de hoy.
  useEffect(() => {
    if (visible) setFecha(dayKey(new Date()));
  }, [visible]);

  // 7 días que terminan en la fecha elegida.
  const dias7 = useMemo(() => {
    const arr = [];
    const base = new Date(`${fecha}T00:00:00`);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      arr.push(dayKey(d));
    }
    return arr;
  }, [fecha]);

  const hoy = fecha;
  const serie = (mapa, fn = (v) => Number(v) || 0) => dias7.map((k) => fn(mapa?.[k]));

  const kcalDia = (arr) => (arr || []).reduce((a, c) => a + (Number(c.kcal) || 0), 0);
  const camDia = (k) => (caminatas || []).filter((c) => c.fecha === k);
  const distDia = (k) => camDia(k).reduce((a, c) => a + (Number(c.metros) || 0), 0);
  const minDia = (k) => camDia(k).reduce((a, c) => a + (Number(c.secs) || 0), 0) / 60;

  const camRef = camDia(fecha)[0];
  const velocidad = camRef && camRef.secs > 0 ? (camRef.metros / 1000) / (camRef.secs / 3600) : null;

  // Peso: última medición registrada hasta la fecha elegida (se arrastra).
  const pesoKeys = Object.keys(pesoDias || {})
    .filter((k) => k <= fecha)
    .sort();
  const pesoUlt = pesoKeys.length ? Number(pesoDias[pesoKeys[pesoKeys.length - 1]]) : null;

  const animoHoy = animoDias?.[hoy];

  const METRICAS = [
    {
      titulo: "Pasos",
      icon: "walk-outline",
      color: colors.greenBright,
      valor: (Number(pasosHist?.[hoy]) || 0).toLocaleString("es-AR"),
      unidad: "pasos",
      barras: serie(pasosHist),
    },
    {
      titulo: "Distancia de caminata",
      icon: "navigate-outline",
      color: colors.greenBright,
      valor: (distDia(hoy) / 1000).toFixed(1).replace(".", ","),
      unidad: "km",
      barras: dias7.map(distDia),
    },
    {
      titulo: "Tiempo de caminata",
      icon: "time-outline",
      color: colors.greenBright,
      valor: String(Math.round(minDia(hoy))),
      unidad: "min",
      barras: dias7.map(minDia),
    },
    {
      titulo: "Velocidad al caminar",
      icon: "speedometer-outline",
      color: colors.greenBright,
      valor: velocidad != null ? velocidad.toFixed(1).replace(".", ",") : "—",
      unidad: "km/h",
      barras: (caminatas || [])
        .slice(0, 7)
        .reverse()
        .map((c) => (c.secs > 0 ? (c.metros / 1000) / (c.secs / 3600) : 0)),
    },
    {
      titulo: "Hidratación",
      icon: "water-outline",
      color: "#3aa0e0",
      valor: String(Number(aguaDias?.[hoy]) || 0),
      unidad: "ml",
      barras: serie(aguaDias),
    },
    {
      titulo: "Calorías consumidas",
      icon: "flame-outline",
      color: "#e0703f",
      valor: String(kcalDia(comidasDias?.[hoy])),
      unidad: "kcal",
      barras: dias7.map((k) => kcalDia(comidasDias?.[k])),
    },
    {
      titulo: "Ánimo",
      icon: "happy-outline",
      color: "#d6a92e",
      valor: animoHoy ? ANIMO_EMOJI[animoHoy] : "—",
      unidad: animoHoy ? "hoy" : "sin registrar",
      barras: serie(animoDias),
    },
    {
      titulo: "Peso",
      icon: "body-outline",
      color: colors.greenBright,
      valor: pesoUlt != null ? String(pesoUlt).replace(".", ",") : "—",
      unidad: "kg",
      barras: pesoKeys.slice(-7).map((k) => Number(pesoDias[k]) || 0),
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Todos los datos</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.dateNav}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setFecha(addDays(fecha, -1))}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.seccion}>{fechaLabel(fecha, hoyReal)}</Text>
            <TouchableOpacity
              style={styles.dateBtn}
              disabled={fecha >= hoyReal}
              onPress={() => fecha < hoyReal && setFecha(addDays(fecha, 1))}
            >
              <Ionicons name="chevron-forward" size={20} color={fecha >= hoyReal ? colors.cardBorder : colors.text} />
            </TouchableOpacity>
          </View>
          {METRICAS.map((m) => (
            <View key={m.titulo} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.cardHeadLeft}>
                  <Ionicons name={m.icon} size={16} color={m.color} />
                  <Text style={[styles.cardTitulo, { color: m.color }]}>{m.titulo}</Text>
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.valor}>
                  {m.valor} <Text style={styles.unidad}>{m.unidad}</Text>
                </Text>
                <MiniBars valores={m.barras.length ? m.barras : [0]} color={m.color} track={colors.cardBorder} />
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const ui = StyleSheet.create({
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 48 },
});

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    backBtn: { padding: 4 },
    title: { color: colors.text, fontSize: 18, fontWeight: "800" },
    scroll: { padding: 16, paddingBottom: 40, gap: 10 },
    seccion: { color: colors.text, fontSize: 20, fontWeight: "900", textTransform: "capitalize", minWidth: 120, textAlign: "center" },
    dateNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    dateBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },

    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 16,
      padding: 14,
      gap: 10,
    },
    cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cardHeadLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
    cardTitulo: { fontSize: 14, fontWeight: "800", flexShrink: 1 },
    cardBody: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
    valor: { color: colors.text, fontSize: 30, fontWeight: "900" },
    unidad: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  });
