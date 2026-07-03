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
        {/* Selector segmentado ARS · USD · Deudas · Ahorros */}
        <View style={styles.cardStack}>
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
  segmentActive: { backgroundColor: colors.greenSoft },
  segmentText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  segmentTextActive: { color: colors.greenDark },

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
  cardBody: { position: "relative", paddingHorizontal: 2, paddingTop: 16, paddingBottom: 8 },
  cardActions: {
    position: "absolute",
    top: 16,
    right: 2,
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
