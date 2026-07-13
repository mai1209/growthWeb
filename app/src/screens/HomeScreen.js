import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from "react-native-svg";
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
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);

  // Pulso suave para los anillos de la tarjeta (respiran)
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  // La tarjeta de saldo cambia con el tema: oscura en dark, mint clara en light
  const card = isDark
    ? {
        stops: ["#16745a", "#0e444b", "#0a2a33"],
        backup: "#0e444b",
        text: "#ffffff",
        muted: "rgba(236, 246, 243, 0.72)",
        iconBorder: "rgba(236, 246, 243, 0.28)",
        iconBg: "rgba(255, 255, 255, 0.1)",
        glow1: "rgba(20, 217, 95, 0.24)",
        glow2: "rgba(19, 170, 182, 0.22)",
        glow3: "rgba(20, 217, 95, 0.12)",
        lineColor: "rgba(255, 255, 255, 0.16)",
      }
    : {
        stops: ["#9de3c0", "#c4ecd8", "#e8f6ee"],
        backup: "#c4ecd8",
        text: "#16241d",
        muted: "rgba(22, 36, 29, 0.6)",
        iconBorder: "rgba(22, 36, 29, 0.18)",
        iconBg: "rgba(255, 255, 255, 0.45)",
        glow1: "rgba(20, 217, 95, 0.30)",
        glow2: "rgba(19, 170, 182, 0.22)",
        glow3: "rgba(20, 217, 95, 0.16)",
        lineColor: "rgba(22, 36, 29, 0.13)",
      };
  const navigation = useNavigation();
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("ARS");
  const [visible, setVisible] = useState(true);
  const [cardSize, setCardSize] = useState({ w: 0, h: 0 });
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

  // Movimientos del tipo activo (deuda / ahorro), más recientes primero.
  // En Ahorros entran también los usos (egresos pagados con ahorro).
  const typeMovs = useMemo(() => {
    if (isCurrency) return [];
    return movimientos
      .filter((m) => (tab === "ahorro" ? m.tipo === "ahorro" || m.desdeAhorro : m.tipo === tab))
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  }, [movimientos, tab, isCurrency]);

  // Ahorro disponible por moneda (ahorrado - usado)
  const savingsPot = useMemo(() => {
    const pot = { ARS: 0, USD: 0 };
    movimientos.forEach((m) => {
      const cur = m.moneda === "USD" ? "USD" : "ARS";
      const amount = Number(m.monto) || 0;
      if (m.tipo === "ahorro") pot[cur] += amount;
      else if (m.desdeAhorro) pot[cur] -= amount;
    });
    return pot;
  }, [movimientos]);

  const currencyMeta = getCurrencyMeta(currency);
  const money = (amount) => (visible ? formatMoney(amount, currency) : "••••");
  const moneyOf = (amount, mon) => (visible ? formatMoney(amount, mon || "ARS") : "••••");

  const quickActions = [
    { key: "ingreso", label: "Ingreso", icon: "arrow-down-outline", color: "#2fa56f" },
    { key: "egreso", label: "Egreso", icon: "arrow-up-outline", color: "#e0654f" },
    { key: "ingreso-fijo", label: "Ing. fijo", icon: "repeat-outline", color: "#2f9e3a" },
    { key: "egreso-fijo", label: "Gasto fijo", icon: "sync-outline", color: "#d9774a" },
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
      {/* Selector segmentado FIJO — ARS · USD · Deudas · Ahorros */}
      <View style={styles.fixedHeader}>
        <View style={styles.segmentRow}>
          {HOME_TABS.map((t) => {
            const active = t.key === tab;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.segment, active && styles.segmentActive]}
                onPress={() => setTab(t.key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={fetchData} tintColor={colors.green} />
        }
      >
        <View style={styles.cardBody}>
            {isCurrency ? (
              <>
                {/* Tarjeta de saldo estilo credit card */}
                <View
                  style={[styles.balanceCard, { backgroundColor: card.backup }]}
                  onLayout={(e) =>
                    setCardSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
                  }
                >
                  {cardSize.w > 0 ? (
                    <>
                      <Svg width={cardSize.w} height={cardSize.h} style={StyleSheet.absoluteFill}>
                        <Defs>
                          <LinearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0" stopColor={card.stops[0]} />
                            <Stop offset="0.5" stopColor={card.stops[1]} />
                            <Stop offset="1" stopColor={card.stops[2]} />
                          </LinearGradient>
                        </Defs>
                        <Rect width={cardSize.w} height={cardSize.h} rx={24} fill="url(#cardGrad)" />
                        {/* Glow suave */}
                        <Circle cx={cardSize.w * 0.82} cy={cardSize.h * 0.2} r={74} fill={card.glow1} />
                        <Circle cx={cardSize.w * 0.12} cy={cardSize.h * 1.05} r={70} fill={card.glow3} />
                      </Svg>

                      {/* Anillos concéntricos que respiran (capa animada) */}
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          StyleSheet.absoluteFill,
                          { opacity: ringOpacity, transform: [{ scale: ringScale }] },
                        ]}
                      >
                        <Svg width={cardSize.w} height={cardSize.h}>
                          {[52, 108, 168, 232, 300].map((r, i) => (
                            <Circle
                              key={r}
                              cx={cardSize.w * 0.82}
                              cy={cardSize.h * 0.2}
                              r={r}
                              fill="none"
                              stroke={card.lineColor}
                              strokeWidth={1}
                              opacity={0.9 - i * 0.15}
                            />
                          ))}
                        </Svg>
                      </Animated.View>
                    </>
                  ) : null}

                  <View style={styles.bcTop}>
                    <Text style={[styles.bcKicker, { color: card.muted }]}>Saldo total</Text>
                    <View style={styles.bcIcons}>
                      <TouchableOpacity
                        style={[styles.bcIconBtn, { borderColor: card.iconBorder, backgroundColor: card.iconBg }]}
                        onPress={() => goToFilter(null)}
                        hitSlop={6}
                      >
                        <Ionicons name="funnel-outline" size={16} color={card.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.bcIconBtn, { borderColor: card.iconBorder, backgroundColor: card.iconBg }]}
                        onPress={() => setShowHistory(true)}
                        hitSlop={6}
                      >
                        <Ionicons name="time-outline" size={17} color={card.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.bcIconBtn, { borderColor: card.iconBorder, backgroundColor: card.iconBg }]}
                        onPress={() => setVisible((v) => !v)}
                        hitSlop={6}
                      >
                        <Ionicons
                          name={visible ? "eye-outline" : "eye-off-outline"}
                          size={17}
                          color={card.text}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {loading ? (
                    <ActivityIndicator color="#14d95f" style={{ alignSelf: "flex-start", marginVertical: 14 }} />
                  ) : (
                    <Text style={[styles.bcBalance, { color: card.text }]}>{money(historical.total)}</Text>
                  )}

                  {/* Acciones dentro de la tarjeta (estilo referencia) */}
                  <View
                    style={[
                      styles.bcActions,
                      { backgroundColor: card.iconBg, borderColor: card.iconBorder },
                    ]}
                  >
                    {quickActions.map((a) => (
                      <TouchableOpacity
                        key={a.key}
                        style={styles.quickItem}
                        onPress={() => setModalMode(a.key)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={a.icon} size={25} color={a.color} />
                        <Text style={[styles.quickLabel, { color: card.text }]} numberOfLines={1}>
                          {a.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

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
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => setVisible((v) => !v)} hitSlop={6}>
                    <Ionicons
                      name={visible ? "eye-outline" : "eye-off-outline"}
                      size={19}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.balanceLabel}>{tab === "deuda" ? "Deudas" : "Ahorros"}</Text>
                {tab === "ahorro" ? (
                  <Text style={styles.potText}>
                    Disponible:{" "}
                    {visible
                      ? [
                          savingsPot.ARS !== 0 || savingsPot.USD === 0
                            ? formatMoney(savingsPot.ARS, "ARS")
                            : null,
                          savingsPot.USD !== 0 ? formatMoney(savingsPot.USD, "USD") : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "••••"}
                  </Text>
                ) : (
                  <Text style={styles.balanceSub}>
                    {typeMovs.length} {typeMovs.length === 1 ? "movimiento" : "movimientos"}
                  </Text>
                )}

                {/* Botones del tipo activo */}
                <View style={styles.typeBtnRow}>
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

                  {tab === "ahorro" ? (
                    <TouchableOpacity
                      style={styles.useTypeBtn}
                      onPress={() => setModalMode("ahorro-uso")}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="cart-outline" size={18} color="#2bb888" />
                      <Text style={styles.useTypeText}>Usar ahorro</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

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
                              {m.desdeAhorro ? (
                                <Text style={[styles.movChip, { color: "#4fb6c9" }]}>Uso de ahorro</Text>
                              ) : null}
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.movAmount,
                              { color: m.tipo === "deuda" ? "#e6bc3f" : "#35cfa4" },
                            ]}
                          >
                            {m.desdeAhorro ? "- " : ""}
                            {moneyOf(m.monto, m.moneda)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </View>
      </ScrollView>

      <MovementFormModal
        visible={Boolean(modalMode)}
        modeKey={modalMode}
        defaultCurrency={currency}
        movimientos={movimientos}
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
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 28 },

  fixedHeader: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, backgroundColor: colors.bg },
  cardStack: { position: "relative" },

  // Selector segmentado tipo píldora (mismo lenguaje que Filtros/Métricas)
  segmentRow: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 4,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
  },
  segmentActive: { backgroundColor: colors.segActive },
  segmentText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  segmentTextActive: { color: colors.segActiveText, fontWeight: "800" },

  sectionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 10,
  },

  // Contenido flotando, sin marco
  cardBody: { position: "relative", paddingTop: 10, paddingBottom: 8 },
  cardActions: {
    position: "absolute",
    top: 10,
    right: 0,
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

  // ===== Tarjeta de saldo (estilo credit card) =====
  balanceCard: {
    borderRadius: 24,
    padding: 18,
    minHeight: 172,
    justifyContent: "space-between",
    overflow: "hidden",
    backgroundColor: "#0c333c", // respaldo hasta que el SVG mida la tarjeta
  },
  bcTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bcKicker: {
    color: "rgba(236, 246, 243, 0.65)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  bcIcons: { flexDirection: "row", gap: 8 },
  bcIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(236, 246, 243, 0.22)",
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  bcBalance: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  bcFooter: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  bcCurrency: {
    color: "rgba(236, 246, 243, 0.85)",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  bcActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    gap: 4,
    marginTop: 16,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickItem: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 2 },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { color: colors.text, fontWeight: "700", fontSize: 12.5 },

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
  potText: { color: "#2bb888", fontSize: 14, fontWeight: "800", marginTop: 4 },
  typeBtnRow: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  addTypeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  useTypeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#2bb888",
    backgroundColor: "rgba(43, 184, 136, 0.12)",
  },
  useTypeText: { color: "#2bb888", fontWeight: "800", fontSize: 12.5 },
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
