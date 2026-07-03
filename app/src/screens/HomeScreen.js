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
  filterMovimientosByCurrency,
  formatMoney,
  getCurrencyMeta,
  isSameMonth,
  summarizeByType,
} from "../utils/finance";

// Geometría del marco verde tipo "pestaña": contorno con la pestaña activa
// sobresaliendo hacia arriba. Generalizado a N pestañas de igual ancho.
const TAB_H = 40; // alto de la zona de pestañas
const buildFramePaths = (W, H, activeIndex, count) => {
  if (!W || !H || !count) return { fill: "", outline: "" };
  const L = 1;
  const R = W - 1;
  const T = 1;
  const B = H - 1;
  const bodyTop = T + TAB_H;
  const rT = 11; // esquinas superiores de la pestaña
  const rB = 20; // esquinas del cuerpo
  const rBase = 8; // curva donde la pestaña se une al cuerpo
  const seg = (R - L) / count;
  const xa = L + activeIndex * seg; // borde izquierdo de la pestaña activa
  const xb = L + (activeIndex + 1) * seg; // borde derecho de la pestaña activa
  const atLeft = activeIndex === 0;
  const atRight = activeIndex === count - 1;

  // --- Contorno (sentido horario) ---
  let d = "";
  if (atLeft) {
    d += `M ${L} ${T + rT} Q ${L} ${T} ${L + rT} ${T} `;
  } else {
    d += `M ${L} ${bodyTop + rB} Q ${L} ${bodyTop} ${L + rB} ${bodyTop} `;
    d += `L ${xa - rBase} ${bodyTop} Q ${xa} ${bodyTop} ${xa} ${bodyTop - rBase} `;
    d += `L ${xa} ${T + rT} Q ${xa} ${T} ${xa + rT} ${T} `;
  }

  if (atRight) {
    d += `L ${R - rT} ${T} Q ${R} ${T} ${R} ${T + rT} `;
  } else {
    d += `L ${xb - rT} ${T} Q ${xb} ${T} ${xb} ${T + rT} `;
    d += `L ${xb} ${bodyTop - rBase} Q ${xb} ${bodyTop} ${xb + rBase} ${bodyTop} `;
    d += `L ${R - rB} ${bodyTop} Q ${R} ${bodyTop} ${R} ${bodyTop + rB} `;
  }

  d += `L ${R} ${B - rB} Q ${R} ${B} ${R - rB} ${B} `;
  d += `L ${L + rB} ${B} Q ${L} ${B} ${L} ${B - rB} `;
  d += atLeft ? `L ${L} ${T + rT} Z` : `L ${L} ${bodyTop + rB} Z`;

  const fL = atLeft ? L : xa;
  const fR = atRight ? R : xb;
  const fill =
    `M ${fL} ${bodyTop} L ${fL} ${T + rT} Q ${fL} ${T} ${fL + rT} ${T} ` +
    `L ${fR - rT} ${T} Q ${fR} ${T} ${fR} ${T + rT} L ${fR} ${bodyTop} Z`;

  return { fill, outline: d };
};

const HOME_TABS = [
  { key: "ARS", label: "ARS" },
  { key: "USD", label: "USD" },
  { key: "deuda", label: "Deudas" },
  { key: "ahorro", label: "Ahorros" },
];

const fmtDate = (value) => {
  const s = String(value || "").slice(0, 10);
  const [y, m, d] = s.split("-");
  return y && m && d ? `${d}/${m}/${y}` : s;
};

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const navigation = useNavigation();
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("ARS");
  const [visible, setVisible] = useState(true);
  const [modalMode, setModalMode] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const isCurrency = tab === "ARS" || tab === "USD";
  const currency = isCurrency ? tab : "ARS";

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

  // Movimientos del tipo activo (deuda / ahorro), más recientes primero
  const typeMovs = useMemo(() => {
    if (isCurrency) return [];
    return movimientos
      .filter((m) => m.tipo === tab)
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  }, [movimientos, tab, isCurrency]);

  const currencyMeta = getCurrencyMeta(currency);
  const money = (amount) => (visible ? formatMoney(amount, currency) : "••••");
  const moneyOf = (amount, mon) => (visible ? formatMoney(amount, mon || "ARS") : "••••");

  const activeIndex = HOME_TABS.findIndex((t) => t.key === tab);
  const { outline: frameOutline } = buildFramePaths(frame.w, frame.h, activeIndex, HOME_TABS.length);


  const quickActions = [
    { key: "ingreso", label: "Nuevo ingreso", icon: "arrow-down-circle-outline", bg: "#35b53a" },
    { key: "egreso", label: "Nuevo egreso", icon: "arrow-up-circle-outline", bg: "#e0654f" },
    { key: "ingreso-fijo", label: "Ingreso fijo", icon: "repeat-outline", bg: "#2f9e3a" },
    { key: "egreso-fijo", label: "Gasto fijo", icon: "repeat-outline", bg: "#d9774a" },
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
            {HOME_TABS.map((t) => {
              const active = t.key === tab;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={styles.tabHalf}
                  onPress={() => setTab(t.key)}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.tabCode, active ? styles.tabCodeFront : styles.tabCodeBehind]}>
                    {t.label}
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

            {isCurrency ? (
              <>
                <Text style={styles.balanceLabel}>{currencyMeta.codeLabel}</Text>
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
                      <Ionicons name={a.icon} size={18} color="#fff" />
                      <Text style={styles.quickLabel}>{a.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Movimientos del mes (clickeables → Filtros filtrado) */}
                <Text style={styles.sectionLabel}>Resumen</Text>
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
              </>
            ) : (
              <>
                <Text style={styles.balanceLabel}>{tab === "deuda" ? "Deudas" : "Ahorros"}</Text>
                <Text style={styles.balanceSub}>
                  {typeMovs.length} {typeMovs.length === 1 ? "movimiento" : "movimientos"}
                </Text>

                {/* Botón rápido para cargar del tipo activo */}
                <TouchableOpacity
                  style={[styles.addTypeBtn, { backgroundColor: tab === "deuda" ? "#d6a92e" : "#2bb888" }]}
                  onPress={() => setModalMode(tab)}
                  activeOpacity={0.85}
                >
                  <Ionicons name={tab === "deuda" ? "person-outline" : "wallet-outline"} size={18} color="#fff" />
                  <Text style={styles.quickLabel}>
                    {tab === "deuda" ? "Cargar deuda" : "Nuevo ahorro"}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.sectionLabel}>Movimientos</Text>
                {loading ? (
                  <ActivityIndicator color={colors.green} style={{ alignSelf: "flex-start", marginTop: 6 }} />
                ) : error ? (
                  <Text style={styles.error}>{error}</Text>
                ) : typeMovs.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No hay {tab === "deuda" ? "deudas" : "ahorros"} cargados todavía.
                  </Text>
                ) : (
                  <View style={styles.statGrid}>
                    {typeMovs.map((m) => {
                      const isPaid = m.tipo === "deuda" && m.deudaEstado === "pagada";
                      const isPartial =
                        m.tipo === "deuda" && !isPaid && Number(m.deudaPagado) > 0;
                      return (
                        <TouchableOpacity
                          key={m._id}
                          style={styles.movRow}
                          activeOpacity={0.7}
                          onPress={() => goToFilter(tab)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.movTitle} numberOfLines={1}>
                              {m.categoria || "Sin categoría"}
                            </Text>
                            {m.deudaAcreedor ? (
                              <Text style={styles.movSub} numberOfLines={1}>
                                Acreedor: {m.deudaAcreedor}
                              </Text>
                            ) : m.detalle ? (
                              <Text style={styles.movSub} numberOfLines={1}>
                                {m.detalle}
                              </Text>
                            ) : null}
                            <View style={styles.movMetaRow}>
                              <Text style={styles.movDate}>{fmtDate(m.fecha)}</Text>
                              {m.tipo === "deuda" ? (
                                <Text
                                  style={[
                                    styles.movChip,
                                    { color: isPaid ? colors.greenDark : isPartial ? colors.greenDark : "#d6a92e" },
                                  ]}
                                >
                                  {isPaid ? "Pagada" : isPartial ? "Parcial" : "Pendiente"}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                          <Text style={styles.movAmount}>{moneyOf(m.monto, m.moneda)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}
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
  tabCode: { fontWeight: "700", fontSize: 13, letterSpacing: 0.3 },
  tabCodeFront: { color: colors.greenBright }, // seleccionada: solo texto verde
  tabCodeBehind: { color: colors.text },
  tabLbl: { fontSize: 11, fontWeight: "700", marginTop: 1 },
  tabLblFront: { color: colors.green },
  tabLblBehind: { color: colors.muted },

  sectionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
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
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  quickLabel: { color: "#fff", fontWeight: "600", fontSize: 13, flexShrink: 1 },

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

  balanceSub: { color: colors.muted, fontSize: 13, marginTop: 4 },
  addTypeBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    marginTop: 14,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  emptyText: { color: colors.muted, fontSize: 14, marginTop: 4 },
  movRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  movTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  movSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  movMetaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  movDate: { color: colors.muted, fontSize: 11 },
  movChip: { fontSize: 11, fontWeight: "800" },
  movAmount: { color: colors.text, fontSize: 15, fontWeight: "800" },
});
