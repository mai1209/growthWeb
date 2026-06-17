import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { movimientoService } from "../api";
import { statAccents, useTheme } from "../theme";
import MovementFormModal from "../components/MovementFormModal";
import HistoryModal from "../components/HistoryModal";
import {
  CURRENCY_OPTIONS,
  filterMovimientosByCurrency,
  formatMoney,
  getCurrencyMeta,
  isSameMonth,
  summarizeByType,
} from "../utils/finance";

// Geometría del marco verde tipo "pestaña": contorno + relleno de la pestaña activa
const TAB_H = 48; // alto de la zona de pestañas
const buildFramePaths = (W, H, activeLeft) => {
  if (!W || !H) return { fill: "", outline: "" };
  const L = 1;
  const R = W - 1;
  const T = 1;
  const B = H - 1;
  const mid = W / 2;
  const bodyTop = T + TAB_H;
  const rT = 14; // esquinas superiores de la pestaña
  const rB = 22; // esquinas del cuerpo
  const rBase = 12; // curva donde la pestaña se une al cuerpo

  if (!activeLeft) {
    // Pestaña activa a la DERECHA (USD)
    const fill =
      `M ${mid} ${bodyTop} L ${mid} ${T + rT} Q ${mid} ${T} ${mid + rT} ${T} ` +
      `L ${R - rT} ${T} Q ${R} ${T} ${R} ${T + rT} L ${R} ${bodyTop} Z`;
    const outline =
      `M ${L} ${bodyTop + rB} Q ${L} ${bodyTop} ${L + rB} ${bodyTop} ` +
      `L ${mid - rBase} ${bodyTop} Q ${mid} ${bodyTop} ${mid} ${bodyTop - rBase} ` +
      `L ${mid} ${T + rT} Q ${mid} ${T} ${mid + rT} ${T} ` +
      `L ${R - rT} ${T} Q ${R} ${T} ${R} ${T + rT} ` +
      `L ${R} ${B - rB} Q ${R} ${B} ${R - rB} ${B} ` +
      `L ${L + rB} ${B} Q ${L} ${B} ${L} ${B - rB} Z`;
    return { fill, outline };
  }

  // Pestaña activa a la IZQUIERDA (ARS)
  const fill =
    `M ${L} ${bodyTop} L ${L} ${T + rT} Q ${L} ${T} ${L + rT} ${T} ` +
    `L ${mid - rT} ${T} Q ${mid} ${T} ${mid} ${T + rT} L ${mid} ${bodyTop} Z`;
  const outline =
    `M ${L} ${T + rT} Q ${L} ${T} ${L + rT} ${T} ` +
    `L ${mid - rT} ${T} Q ${mid} ${T} ${mid} ${T + rT} ` +
    `L ${mid} ${bodyTop - rBase} Q ${mid} ${bodyTop} ${mid + rBase} ${bodyTop} ` +
    `L ${R - rB} ${bodyTop} Q ${R} ${bodyTop} ${R} ${bodyTop + rB} ` +
    `L ${R} ${B - rB} Q ${R} ${B} ${R - rB} ${B} ` +
    `L ${L + rB} ${B} Q ${L} ${B} ${L} ${B - rB} Z`;
  return { fill, outline };
};

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const navigation = useNavigation();
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [visible, setVisible] = useState(true);
  const [modalMode, setModalMode] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const goToFilter = (tipo) =>
    navigation.navigate("Filtros", { tipo: tipo || "all", currency, nonce: Date.now() });

  const fetchData = useCallback(async () => {
    setError("");
    try {
      const res = await movimientoService.getAll({ workspace: "personal" });
      setMovimientos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError("No se pudieron cargar los movimientos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { historical, monthSummary, monthCount } = useMemo(() => {
    const byCurrency = filterMovimientosByCurrency(movimientos, currency);
    const monthMovs = byCurrency.filter((m) => isSameMonth(m.fecha));
    return {
      historical: summarizeByType(byCurrency),
      monthSummary: summarizeByType(monthMovs),
      monthCount: monthMovs.length,
    };
  }, [movimientos, currency]);

  const currencyMeta = getCurrencyMeta(currency);
  const money = (amount) => (visible ? formatMoney(amount, currency) : "••••");

  const activeLeft = currency === CURRENCY_OPTIONS[0].value;
  const { fill: frameFill, outline: frameOutline } = buildFramePaths(frame.w, frame.h, activeLeft);


  const quickActions = [
    { key: "ingreso-fijo", label: "Ingreso fijo", icon: "repeat-outline", bg: "#2f9e3a" },
    { key: "ingreso", label: "Nuevo ingreso", icon: "arrow-down-circle-outline", bg: "#35b53a" },
    { key: "ahorro", label: "Nuevo ahorro", icon: "wallet-outline", bg: "#2bb888" },
    { key: "deuda", label: "Cargar deuda", icon: "person-outline", bg: "#d6a92e" },
    { key: "egreso-fijo", label: "Gasto fijo", icon: "repeat-outline", bg: "#d9774a" },
    { key: "egreso", label: "Nuevo egreso", icon: "arrow-up-circle-outline", bg: "#e0654f" },
  ];

  const stats = [
    { label: "Movimientos del mes", value: visible ? String(monthCount) : "••", accent: statAccents.movimientos, tipo: null },
    { label: "Resultado mensual", value: money(monthSummary.total), accent: statAccents.resultado, tipo: null },
    { label: "Ingresos del mes", value: money(monthSummary.ingreso), accent: statAccents.ingreso, tipo: "ingreso" },
    { label: "Egresos del mes", value: money(monthSummary.egreso), accent: statAccents.egreso, tipo: "egreso" },
    { label: "Ahorro del mes", value: money(monthSummary.ahorro), accent: statAccents.ahorro, tipo: "ahorro" },
    { label: "Deuda pendiente", value: money(historical.deudaPendiente), accent: statAccents.deuda, tipo: "deuda" },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={fetchData} tintColor={colors.green} />
        }
      >
        {/* Marco verde tipo pestaña: solo la activa pintada, el resto contorno */}
        <View
          style={styles.cardStack}
          onLayout={(e) =>
            setFrame({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
          }
        >
          {frame.w > 0 ? (
            <Svg
              width={frame.w}
              height={frame.h}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            >
              <Path
                d={frameOutline}
                stroke={colors.greenBright}
                strokeWidth={2}
                fill="none"
                strokeLinejoin="round"
              />
            </Svg>
          ) : null}

          <View style={styles.tabRow}>
            {CURRENCY_OPTIONS.map((opt) => {
              const active = opt.value === currency;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.tabHalf}
                  onPress={() => setCurrency(opt.value)}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.tabCode, active ? styles.tabCodeFront : styles.tabCodeBehind]}>
                    {opt.codeLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.cardBody}>
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => goToFilter(null)} hitSlop={6}>
                <Ionicons name="funnel-outline" size={18} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowHistory(true)} hitSlop={6}>
                <Ionicons name="time-outline" size={19} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setVisible((v) => !v)} hitSlop={6}>
                <Ionicons
                  name={visible ? "eye-outline" : "eye-off-outline"}
                  size={19}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.kicker}>Resumen</Text>
            <Text style={styles.balanceTitle}>Dashboard {currencyMeta.codeLabel}</Text>

            <Text style={styles.balanceLabel}>Saldo</Text>
            {loading ? (
              <ActivityIndicator color={colors.green} style={{ alignSelf: "flex-start", marginTop: 6 }} />
            ) : (
              <Text style={styles.balanceValue}>{money(historical.total)}</Text>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {/* Accesos rápidos */}
            <Text style={styles.sectionLabel}>Cargar movimiento</Text>
            <View style={styles.quickGrid}>
              {quickActions.map((a) => (
                <TouchableOpacity
                  key={a.key}
                  style={[styles.quickBtn, { backgroundColor: a.bg }]}
                  onPress={() => setModalMode(a.key)}
                  activeOpacity={0.85}
                >
                  <Ionicons name={a.icon} size={20} color="#fff" />
                  <Text style={styles.quickLabel}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Movimientos del mes (clickeables → Filtros filtrado) */}
            <Text style={styles.sectionLabel}>Este mes</Text>
            <View style={styles.statGrid}>
              {stats.map((s) => (
                <TouchableOpacity
                  key={s.label}
                  style={styles.statCard}
                  activeOpacity={0.7}
                  onPress={() => goToFilter(s.tipo)}
                >
                  <View style={[styles.statBar, { backgroundColor: s.accent }]} />
                  <Text style={styles.statLabel}>{s.label}</Text>
                  <Text style={styles.statValue}>{s.value}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <MovementFormModal
        visible={Boolean(modalMode)}
        modeKey={modalMode}
        defaultCurrency={currency}
        onClose={() => setModalMode(null)}
        onSaved={fetchData}
      />

      <HistoryModal
        visible={showHistory}
        movimientos={movimientos}
        currency={currency}
        onClose={() => setShowHistory(false)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 28 },

  cardStack: { position: "relative" },

  // Pestañas ARS / USD lado a lado dentro del marco
  tabRow: { flexDirection: "row", height: TAB_H },
  tabHalf: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabCode: { fontWeight: "900", fontSize: 16 },
  tabCodeFront: { color: colors.greenBright }, // seleccionada: solo texto verde
  tabCodeBehind: { color: colors.text },
  tabLbl: { fontSize: 11, fontWeight: "700", marginTop: 1 },
  tabLblFront: { color: colors.green },
  tabLblBehind: { color: colors.muted },

  sectionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 10,
  },

  // El cuerpo va transparente: el "card" es solo el contorno verde del SVG
  cardBody: { position: "relative", paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18 },
  cardActions: {
    position: "absolute",
    top: 12,
    right: 14,
    flexDirection: "row",
    gap: 8,
    zIndex: 2,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    color: colors.green,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  balanceTitle: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 4 },
  balanceLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 16,
  },
  balanceValue: { color: colors.text, fontSize: 34, fontWeight: "900", marginTop: 4 },
  error: { color: colors.red, marginTop: 4 },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickBtn: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  quickLabel: { color: "#fff", fontWeight: "800", fontSize: 14, flexShrink: 1 },

  statGrid: { gap: 10 },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    paddingVertical: 14,
    paddingRight: 16,
    paddingLeft: 18,
    overflow: "hidden",
  },
  statBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  statLabel: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statValue: { color: colors.text, fontSize: 17, fontWeight: "800", textAlign: "right" },
});
