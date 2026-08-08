import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import CalendarioFechas from "./CalendarioFechas";
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

// Path SVG suavizado (curvas) a partir de puntos [x,y].
function smoothPath(pts) {
  if (pts.length < 2) return pts.length ? `M ${pts[0][0]} ${pts[0][1]}` : "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

// Gráfico de línea de toda la serie (como el de la web).
function MiniLine({ valores, color, muted }) {
  const W = 100;
  const H = 48;
  if (!valores || valores.length < 2) {
    return <Text style={{ color: muted, fontSize: 13, paddingVertical: 8 }}>Necesitás al menos 2 registros para ver el gráfico.</Text>;
  }
  const max = Math.max(...valores, 1);
  const min = Math.min(...valores, 0);
  const range = max - min || 1;
  const pts = valores.map((v, i) => [
    (i / (valores.length - 1)) * W,
    H - ((v - min) / range) * (H - 8) - 4,
  ]);
  const linea = smoothPath(pts);
  const area = `${linea} L ${W} ${H} L 0 ${H} Z`;
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Path d={area} fill={color} opacity={0.13} />
      <Path d={linea} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

// Historial completo de una métrica: gráfico + lista de cada registro.
function HistorialDetalle({ metric, hoy, colors, styles, onClose }) {
  if (!metric) return null;
  const { titulo, color, unidad, getVal, keys, fmt, emoji } = metric;
  const fechas = [...new Set(keys())].filter(Boolean).filter((k) => getVal(k) > 0).sort();
  const serie = fechas.map((k) => getVal(k)).slice(-30);
  const lista = [...fechas].reverse();
  const fmtValor = (v) => (emoji ? emoji[Math.round(v)] || "—" : fmt(v));
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.detOverlay}>
        <View style={styles.detCard}>
          <View style={styles.detHead}>
            <Text style={[styles.detTitle, { color }]}>{titulo}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <MiniLine valores={serie} color={color} muted={colors.muted} />
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ paddingBottom: 6 }}>
            {lista.length ? (
              lista.map((k) => (
                <View key={k} style={styles.detFila}>
                  <Text style={styles.detFecha}>{fechaLabel(k, hoy)}</Text>
                  <Text style={[styles.detValor, { color }]}>
                    {fmtValor(getVal(k))} {!emoji ? <Text style={styles.detUnidad}>{unidad}</Text> : null}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.detVacio}>Todavía no hay registros de {titulo.toLowerCase()}.</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  tendencia,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const hoyReal = dayKey(new Date());
  const [fecha, setFecha] = useState(hoyReal);
  const [histSel, setHistSel] = useState(null); // métrica abierta en el historial completo
  const [calAbierto, setCalAbierto] = useState(false); // calendario para saltar de fecha

  // ¿Ese día tiene algún dato cargado? (para el puntito del calendario)
  const tieneDatos = (k) =>
    (Number(pasosHist?.[k]) || 0) > 0 ||
    (Number(aguaDias?.[k]) || 0) > 0 ||
    !!animoDias?.[k] ||
    (Number(pesoDias?.[k]) || 0) > 0 ||
    (Array.isArray(comidasDias?.[k]) && comidasDias[k].length > 0) ||
    (caminatas || []).some((c) => c.fecha === k);
  // Al abrir el modal, arranca en el día de hoy.
  useEffect(() => {
    if (visible) {
      setFecha(dayKey(new Date()));
      setCalAbierto(false);
    }
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

  const keysCaminatas = () => (caminatas || []).map((c) => c.fecha);
  const velDia = (k) => {
    const c = camDia(k)[0];
    return c && c.secs > 0 ? (c.metros / 1000) / (c.secs / 3600) : 0;
  };

  const METRICAS = [
    {
      titulo: "Pasos",
      icon: "walk-outline",
      color: colors.greenBright,
      valor: (Number(pasosHist?.[hoy]) || 0).toLocaleString("es-AR"),
      unidad: "pasos",
      barras: serie(pasosHist),
      getVal: (k) => Number(pasosHist?.[k]) || 0,
      keys: () => Object.keys(pasosHist || {}),
      fmt: (v) => Math.round(v).toLocaleString("es-AR"),
    },
    {
      titulo: "Distancia (actividad)",
      icon: "navigate-outline",
      color: colors.greenBright,
      valor: (distDia(hoy) / 1000).toFixed(1).replace(".", ","),
      unidad: "km",
      barras: dias7.map(distDia),
      getVal: (k) => distDia(k) / 1000,
      keys: keysCaminatas,
      fmt: (v) => v.toFixed(2).replace(".", ","),
    },
    {
      titulo: "Tiempo (actividad)",
      icon: "time-outline",
      color: colors.greenBright,
      valor: String(Math.round(minDia(hoy))),
      unidad: "min",
      barras: dias7.map(minDia),
      getVal: (k) => minDia(k),
      keys: keysCaminatas,
      fmt: (v) => String(Math.round(v)),
    },
    {
      titulo: "Velocidad promedio",
      icon: "speedometer-outline",
      color: colors.greenBright,
      valor: velocidad != null ? velocidad.toFixed(1).replace(".", ",") : "—",
      unidad: "km/h",
      barras: (caminatas || [])
        .slice(0, 7)
        .reverse()
        .map((c) => (c.secs > 0 ? (c.metros / 1000) / (c.secs / 3600) : 0)),
      getVal: velDia,
      keys: keysCaminatas,
      fmt: (v) => v.toFixed(1).replace(".", ","),
    },
    {
      titulo: "Hidratación",
      icon: "water-outline",
      color: "#3aa0e0",
      valor: String(Number(aguaDias?.[hoy]) || 0),
      unidad: "ml",
      barras: serie(aguaDias),
      getVal: (k) => Number(aguaDias?.[k]) || 0,
      keys: () => Object.keys(aguaDias || {}),
      fmt: (v) => Math.round(v).toLocaleString("es-AR"),
    },
    {
      titulo: "Calorías consumidas",
      icon: "flame-outline",
      color: "#e0703f",
      valor: String(kcalDia(comidasDias?.[hoy])),
      unidad: "kcal",
      barras: dias7.map((k) => kcalDia(comidasDias?.[k])),
      getVal: (k) => kcalDia(comidasDias?.[k]),
      keys: () => Object.keys(comidasDias || {}),
      fmt: (v) => Math.round(v).toLocaleString("es-AR"),
    },
    {
      titulo: "Peso",
      icon: "body-outline",
      color: colors.greenBright,
      valor: pesoUlt != null ? String(pesoUlt).replace(".", ",") : "—",
      unidad: "kg",
      barras: pesoKeys.slice(-7).map((k) => Number(pesoDias[k]) || 0),
      getVal: (k) => Number(pesoDias?.[k]) || 0,
      keys: () => Object.keys(pesoDias || {}),
      fmt: (v) => String(v).replace(".", ","),
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>
              Todos los resultados de hoy
            </Text>
          </View>
          <TouchableOpacity onPress={() => setCalAbierto((v) => !v)} hitSlop={10}>
            <Ionicons
              name={calAbierto ? "chevron-up" : "calendar-outline"}
              size={22}
              color={colors.greenBright}
            />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {tendencia ? <View>{tendencia}</View> : null}
          <View style={styles.dateNav}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setFecha(addDays(fecha, -1))}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.fechaBtn} onPress={() => setCalAbierto((v) => !v)} activeOpacity={0.7}>
              <Text style={styles.seccion}>{fechaLabel(fecha, hoyReal)}</Text>
              <Ionicons
                name={calAbierto ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.muted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateBtn}
              disabled={fecha >= hoyReal}
              onPress={() => fecha < hoyReal && setFecha(addDays(fecha, 1))}
            >
              <Ionicons name="chevron-forward" size={20} color={fecha >= hoyReal ? colors.cardBorder : colors.text} />
            </TouchableOpacity>
          </View>

          {calAbierto ? (
            <View style={{ marginBottom: 10 }}>
              <CalendarioFechas
                fechaSel={fecha}
                tieneDatos={tieneDatos}
                onSelect={(k) => {
                  setFecha(k);
                  setCalAbierto(false);
                }}
              />
            </View>
          ) : null}
          {METRICAS.map((m) => (
            <TouchableOpacity
              key={m.titulo}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => setHistSel(m.titulo)}
            >
              <View style={styles.cardHead}>
                <View style={styles.cardHeadLeft}>
                  <Ionicons name={m.icon} size={16} color={m.color} />
                  <Text style={[styles.cardTitulo, { color: m.color }]}>{m.titulo}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.valor}>
                  {m.valor} <Text style={styles.unidad}>{m.unidad}</Text>
                </Text>
                <MiniBars valores={m.barras.length ? m.barras : [0]} color={m.color} track={colors.cardBorder} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <HistorialDetalle
          metric={histSel ? METRICAS.find((m) => m.titulo === histSel) : null}
          hoy={hoyReal}
          colors={colors}
          styles={styles}
          onClose={() => setHistSel(null)}
        />
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
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
    title: { color: colors.text, fontSize: 18, fontWeight: "800" },
    scroll: { padding: 16, paddingBottom: 40, gap: 10 },
    seccion: { color: colors.text, fontSize: 20, fontWeight: "900", textTransform: "capitalize", textAlign: "center" },
    fechaBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
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

    // Detalle / historial completo por métrica
    detOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "center",
      padding: 18,
    },
    detCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 20,
      padding: 16,
      gap: 10,
    },
    detHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    detTitle: { fontSize: 17, fontWeight: "800", flex: 1 },
    detFila: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 9,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    detFecha: { color: colors.muted, fontSize: 14, fontWeight: "600", textTransform: "capitalize" },
    detValor: { fontSize: 15, fontWeight: "800" },
    detUnidad: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    detVacio: { color: colors.muted, fontSize: 13, paddingVertical: 12, textAlign: "center" },
  });
