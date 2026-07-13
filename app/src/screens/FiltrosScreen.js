import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  SectionList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { movimientoService, categoriesService } from "../api";
import MovementFormModal from "../components/MovementFormModal";
import SettlePersonalDebtModal from "../components/SettlePersonalDebtModal";
import { statAccents, useTheme } from "../theme";
import {
  CURRENCY_OPTIONS,
  MOVEMENT_TYPE_OPTIONS,
  filterMovimientosByCurrency,
  summarizeByType,
  formatMoney,
  formatSignedMoney,
  getMovementTypeMeta,
  normalizeMovementType,
  getDayKey,
  formatDayLabel,
} from "../utils/finance";

const TYPE_FILTERS = [{ value: "all", label: "Todos" }, ...MOVEMENT_TYPE_OPTIONS];

const shiftMonth = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const CHART_H = 90; // alto máx de las barras del mini gráfico anual

// Ícono outline por tipo de movimiento (estilo minimalista).
const movementIcon = (m) => {
  if (m.desdeAhorro) return "swap-horizontal-outline";
  if (m.tipo === "ingreso") return "arrow-down-outline";
  if (m.tipo === "ahorro") return "wallet-outline";
  if (m.tipo === "deuda") return "card-outline";
  return "arrow-up-outline"; // egreso
};

export default function FiltrosScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const route = useRoute();
  const [movimientos, setMovimientos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [month, setMonth] = useState(new Date());
  const [period, setPeriod] = useState("month"); // month | year
  const [year, setYear] = useState(new Date().getFullYear());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [editMov, setEditMov] = useState(null);
  const [settleDebt, setSettleDebt] = useState(null);

  const handleDelete = (mov) => {
    Alert.alert("Eliminar movimiento", `¿Borrar "${mov.categoria || "movimiento"}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await movimientoService.delete(mov._id);
            await fetchData();
          } catch {
            Alert.alert("Error", "No se pudo eliminar.");
          }
        },
      },
    ]);
  };

  const fetchData = useCallback(async () => {
    setError("");
    try {
      const res = await movimientoService.getAll();
      setMovimientos(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError("No se pudieron cargar los movimientos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Categorías (para mostrar su emoji en cada movimiento)
  useEffect(() => {
    categoriesService
      .getAll()
      .then((res) => setCategories(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  // Mapa nombre-de-categoría (minúsculas) -> emoji
  const catIcon = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => {
      if (c?.nombre && c?.icono) map.set(c.nombre.trim().toLowerCase(), c.icono);
    });
    return map;
  }, [categories]);

  // Filtro entrante desde el Home (tarjetas de stats)
  useEffect(() => {
    const p = route.params;
    if (!p) return;
    if (p.currency) setCurrency(p.currency);
    if (p.tipo) {
      setType(p.tipo);
      if (p.tipo !== "all") setFiltersOpen(true);
    }
  }, [route.params]);

  const { sections, summary, monthBreakdown } = useMemo(() => {
    const isYear = period === "year";
    const from = isYear
      ? new Date(year, 0, 1)
      : new Date(month.getFullYear(), month.getMonth(), 1);
    const to = isYear
      ? new Date(year, 11, 31)
      : new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const monthMovs = filterMovimientosByCurrency(movimientos, currency, { from, to });

    const q = search.trim().toLowerCase();
    const filtered = monthMovs.filter((m) => {
      const t = normalizeMovementType(m.tipo);
      if (type === "ahorro") {
        // Ahorro incluye los usos de ahorro (egresos pagados con ahorro)
        if (t !== "ahorro" && !m.desdeAhorro) return false;
      } else if (type === "egreso") {
        // Egreso excluye los usos de ahorro (viven en Ahorro)
        if (t !== "egreso" || m.desdeAhorro) return false;
      } else if (type !== "all" && t !== type) return false;
      if (!q) return true;
      const hay = [m.categoria, m.detalle, m.deudaAcreedor, m.tipo]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    // Agrupar por día (desc)
    const map = new Map();
    filtered
      .slice()
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .forEach((m) => {
        const key = getDayKey(m.fecha);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(m);
      });

    // Desglose por mes (vista anual): SIEMPRE los 12 meses del año elegido.
    let breakdown = [];
    if (isYear) {
      const byMonth = new Map();
      filtered.forEach((m) => {
        const mo = new Date(m.fecha).getMonth();
        if (!byMonth.has(mo)) byMonth.set(mo, []);
        byMonth.get(mo).push(m);
      });
      breakdown = Array.from({ length: 12 }, (_, mo) => {
        const movs = byMonth.get(mo) || [];
        return {
          monthIndex: mo,
          label: new Date(year, mo, 1).toLocaleDateString("es-AR", { month: "long" }),
          summary: summarizeByType(movs),
          count: movs.length,
        };
      });
    }

    return {
      summary: summarizeByType(filtered),
      sections: [...map.entries()].map(([key, data]) => ({
        title: formatDayLabel(data[0].fecha),
        data,
      })),
      monthBreakdown: breakdown,
    };
  }, [movimientos, currency, month, year, period, search, type]);

  const monthLabel = month.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const monthShort = month.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
  const periodLabel = period === "year" ? String(year) : monthLabel;
  const goPrev = () =>
    period === "year" ? setYear((y) => y - 1) : setMonth((m) => shiftMonth(m, -1));
  const goNext = () =>
    period === "year" ? setYear((y) => y + 1) : setMonth((m) => shiftMonth(m, 1));

  const yearChartMax = useMemo(() => {
    if (period !== "year") return 1;
    return Math.max(
      1,
      ...monthBreakdown.flatMap((row) => [row.summary.ingreso, row.summary.egreso])
    );
  }, [period, monthBreakdown]);

  const summaryCards = [
    { label: "Ingresos", value: formatMoney(summary.ingreso, currency), accent: statAccents.ingreso },
    { label: "Egresos", value: formatMoney(summary.egreso, currency), accent: statAccents.egreso },
    { label: "Ahorros", value: formatMoney(summary.ahorro, currency), accent: statAccents.ahorro },
    { label: "Deuda pend.", value: formatMoney(summary.deudaPendiente, currency), accent: statAccents.deuda },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {/* ARS/USD + Filtrar */}
      <View style={styles.topBar}>
        <View style={styles.topActions}>
          <View style={styles.currencySwitch}>
            {CURRENCY_OPTIONS.map((opt) => {
              const active = opt.value === currency;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.curBtn, active && styles.curBtnActive]}
                  onPress={() => setCurrency(opt.value)}
                >
                  <Text style={[styles.curText, active && styles.curTextActive]}>{opt.codeLabel}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[styles.filterToggle, filtersOpen && styles.filterToggleActive]}
            onPress={() => setFiltersOpen((v) => !v)}
          >
            <Ionicons name="funnel-outline" size={15} color={filtersOpen ? "#fff" : colors.greenDark} />
            <Text style={[styles.filterToggleText, filtersOpen && { color: "#fff" }]}>Filtrar</Text>
          </TouchableOpacity>
          {search || type !== "all" ? (
            <TouchableOpacity
              style={styles.clearTop}
              onPress={() => {
                setSearch("");
                setType("all");
              }}
            >
              <Ionicons name="close" size={14} color={colors.red} />
              <Text style={styles.clearTopText}>Limpiar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Panel de filtros: búsqueda + chips en una línea */}
      {filtersOpen && (
        <View style={styles.filtersPanel}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Categoría, detalle o tipo"
              placeholderTextColor={colors.muted}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.typeRow}
          >
            {TYPE_FILTERS.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.typeChip, type === t.value && styles.typeChipActive]}
                onPress={() => setType(t.value)}
              >
                <Text style={[styles.typeChipText, type === t.value && styles.typeChipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Totales del mes: fila compacta deslizable, FIJA */}
      <View style={styles.summaryWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.summaryRow}
        >
          {summaryCards.map((c) => (
            <View key={c.label} style={styles.summaryCard}>
              <View style={styles.sumHead}>
                <View style={[styles.sumDot, { backgroundColor: c.accent }]} />
                <Text style={styles.sumLabel}>{c.label}</Text>
              </View>
              <Text style={styles.sumValue}>{c.value}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Encabezado con switch Mes / Año */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionKicker} numberOfLines={1}>
          {period === "year" ? "Resumen anual" : "Detalle del mes"}
        </Text>
        <View style={styles.sectionControls}>
          <View style={styles.periodSwitch}>
            <TouchableOpacity
              style={[styles.periodBtn, period === "month" && styles.periodBtnActive]}
              onPress={() => setPeriod("month")}
            >
              <Text style={[styles.periodText, period === "month" && styles.periodTextActive]}>Mes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.periodBtn, period === "year" && styles.periodBtnActive]}
              onPress={() => setPeriod("year")}
            >
              <Text style={[styles.periodText, period === "year" && styles.periodTextActive]}>Año</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.yearStepper}>
            <TouchableOpacity onPress={goPrev} hitSlop={8}>
              <Ionicons name="chevron-back" size={16} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.yearStepperText}>{period === "year" ? year : monthShort}</Text>
            <TouchableOpacity onPress={goNext} hitSlop={8}>
              <Ionicons name="chevron-forward" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 30 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : period === "year" ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 30, gap: 10 }}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={fetchData} tintColor={colors.green} />
          }
        >
          {/* Mini gráfico de barras del año (ingresos/egresos por mes) */}
          <View style={styles.yearChart}>
            {monthBreakdown.map((row) => {
              const incH = Math.max(2, Math.round((row.summary.ingreso / yearChartMax) * CHART_H));
              const expH = Math.max(2, Math.round((row.summary.egreso / yearChartMax) * CHART_H));
              return (
                <View key={row.monthIndex} style={styles.chartCol}>
                  <View style={styles.chartBars}>
                    <View style={[styles.chartBarInc, { height: incH }]} />
                    <View style={[styles.chartBarExp, { height: expH }]} />
                  </View>
                  <Text style={styles.chartLabel}>{row.label.slice(0, 3)}</Text>
                </View>
              );
            })}
          </View>

          {monthBreakdown.map((row) => (
            <TouchableOpacity
              key={row.monthIndex}
              activeOpacity={0.85}
              style={[styles.monthCard, row.count === 0 && styles.monthCardEmpty]}
              onPress={() => {
                setMonth(new Date(year, row.monthIndex, 1));
                setPeriod("month");
              }}
            >
              <View style={styles.monthCardHead}>
                <Text style={styles.monthCardName}>{row.label}</Text>
                <View style={styles.monthCardCount}>
                  <Text style={styles.monthCardCountText}>{row.count}</Text>
                </View>
              </View>
              <View style={styles.monthCardStats}>
                <View style={styles.monthStat}>
                  <Text style={styles.monthStatLabel}>Ingresos</Text>
                  <Text style={[styles.monthStatValue, { color: colors.greenDark }]}>
                    {formatMoney(row.summary.ingreso, currency)}
                  </Text>
                </View>
                <View style={styles.monthStat}>
                  <Text style={styles.monthStatLabel}>Egresos</Text>
                  <Text style={[styles.monthStatValue, { color: colors.red }]}>
                    {formatMoney(row.summary.egreso, currency)}
                  </Text>
                </View>
                <View style={styles.monthStat}>
                  <Text style={styles.monthStatLabel}>Ahorro</Text>
                  <Text style={styles.monthStatValue}>
                    {formatMoney(row.summary.ahorro, currency)}
                  </Text>
                </View>
                <View style={styles.monthStat}>
                  <Text style={styles.monthStatLabel}>Balance</Text>
                  <Text
                    style={[
                      styles.monthStatValue,
                      { color: row.summary.total >= 0 ? colors.greenDark : colors.red },
                    ]}
                  >
                    {formatMoney(row.summary.total, currency)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <SectionList
          style={{ flex: 1 }}
          sections={sections}
          keyExtractor={(item) => item._id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 30 }}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={fetchData} tintColor={colors.green} />
          }
          ListEmptyComponent={<Text style={styles.empty}>No hay movimientos para mostrar.</Text>}
          renderSectionHeader={({ section }) => (
            <Text style={styles.dayHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const meta = getMovementTypeMeta(item.tipo);
            const isDebt = item.tipo === "deuda";
            const isPendingDebt = isDebt && item.deudaEstado !== "pagada";
            const debtPaid = Number(item.deudaPagado) || 0;
            const debtRemaining = (Number(item.monto) || 0) - debtPaid;
            const isPartialDebt = isPendingDebt && debtPaid > 0;
            const emoji = catIcon.get((item.categoria || "").trim().toLowerCase());
            return (
              <View style={styles.movCard}>
                <View style={[styles.movIcon, { borderColor: meta.color + "55", backgroundColor: meta.color + "1f" }]}>
                  {emoji ? (
                    <Text style={{ fontSize: 20 }}>{emoji}</Text>
                  ) : (
                    <Ionicons name={movementIcon(item)} size={19} color={meta.color} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.movTitle}>{item.categoria || "Sin categoría"}</Text>
                  {item.detalle ? <Text style={styles.movDetail}>{item.detalle}</Text> : null}
                  {isDebt && item.deudaAcreedor ? (
                    <Text style={styles.movDetail}>Acreedor: {item.deudaAcreedor}</Text>
                  ) : null}
                  {isPendingDebt ? (
                    <Text style={styles.debtRemaining}>
                      {isPartialDebt
                        ? `Pagado ${formatMoney(debtPaid, currency)} · resta ${formatMoney(debtRemaining, currency)}`
                        : "Pendiente de pago"}
                    </Text>
                  ) : null}
                  <View style={styles.movChips}>
                    <Text style={[styles.movChip, { color: meta.color }]}>{meta.label}</Text>
                    {isPartialDebt ? (
                      <Text style={[styles.movChip, { color: colors.greenDark }]}>Parcial</Text>
                    ) : null}
                    {item.desdeAhorro ? (
                      <Text style={[styles.movChip, { color: "#4fb6c9" }]}>Uso de ahorro</Text>
                    ) : null}
                    {item.medio ? <Text style={styles.movChip}>{item.medio}</Text> : null}
                  </View>
                  {isPendingDebt ? (
                    <TouchableOpacity
                      style={styles.payDebtBtn}
                      onPress={() => setSettleDebt(item)}
                    >
                      <Ionicons name="cash-outline" size={15} color="#3a2d05" />
                      <Text style={styles.payDebtText}>Pagar deuda</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={styles.movRight}>
                  <Text style={[styles.movAmount, { color: meta.color }]}>
                    {formatSignedMoney(item.monto, currency, item.tipo)}
                  </Text>
                  <View style={styles.movActions}>
                    <TouchableOpacity onPress={() => setEditMov(item)} hitSlop={8}>
                      <Ionicons name="pencil" size={17} color={colors.muted} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={17} color={colors.red} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      <MovementFormModal
        visible={Boolean(editMov)}
        editMovement={editMov}
        defaultCurrency={currency}
        movimientos={movimientos}
        onClose={() => setEditMov(null)}
        onSaved={fetchData}
      />

      <SettlePersonalDebtModal
        visible={Boolean(settleDebt)}
        debt={settleDebt}
        onClose={() => setSettleDebt(null)}
        onSaved={fetchData}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthLabel: { color: colors.text, fontSize: 17, fontWeight: "800", textTransform: "capitalize" },
  topActions: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  clearTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.redSoft,
    backgroundColor: colors.redSoft,
  },
  clearTopText: { color: colors.red, fontWeight: "800", fontSize: 12.5 },
  currencySwitch: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: 4,
  },
  curBtn: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 9 },
  curBtnActive: { backgroundColor: colors.segActive },
  curText: { color: colors.muted, fontWeight: "800", fontSize: 13 },
  curTextActive: { color: colors.segActiveText },
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterToggleActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  filterToggleText: { color: colors.text, fontWeight: "700", fontSize: 13 },

  filtersPanel: {
    margin: 16,
    marginBottom: 0,
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    padding: 14,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.bg,
  },
  searchInput: { flex: 1, paddingVertical: 10, color: colors.text, fontSize: 15 },
  typeRow: { flexDirection: "row", gap: 8, paddingRight: 8 },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bg,
  },
  typeChipActive: { backgroundColor: colors.segActive, borderColor: colors.segActive },
  typeChipText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  typeChipTextActive: { color: colors.segActiveText, fontWeight: "800" },
  clearChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.redSoft,
    backgroundColor: colors.redSoft,
  },
  clearChipText: { color: colors.red, fontWeight: "700", fontSize: 13 },

  error: { color: colors.red, padding: 16 },
  empty: { color: colors.muted, padding: 16, textAlign: "center" },

  summaryWrap: { paddingTop: 10, paddingBottom: 4 },
  summaryRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  summaryCard: {
    minWidth: 128,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sumHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  sumDot: { width: 7, height: 7, borderRadius: 4 },
  sumLabel: { color: colors.muted, fontSize: 10.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  sumValue: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: 5, fontVariant: ["tabular-nums"] },

  // Encabezado de sección + switch Mes/Año
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2,
  },
  sectionKicker: {
    flex: 1,
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  sectionControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  periodSwitch: {
    flexDirection: "row",
    gap: 3,
    padding: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  yearStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  yearStepperText: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    minWidth: 62,
    textAlign: "center",
    textTransform: "capitalize",
  },
  periodBtn: { paddingVertical: 5, paddingHorizontal: 14, borderRadius: 999 },
  periodBtnActive: { backgroundColor: colors.segActive },
  periodText: { color: colors.muted, fontSize: 12.5, fontWeight: "800" },
  periodTextActive: { color: colors.segActiveText },

  // Mini gráfico de barras del año
  yearChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: 8,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  chartCol: { flex: 1, alignItems: "center", gap: 4 },
  chartBars: { height: CHART_H, flexDirection: "row", alignItems: "flex-end", gap: 2 },
  chartBarInc: { width: 6, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: colors.green },
  chartBarExp: { width: 6, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: colors.red },
  chartLabel: { fontSize: 9, fontWeight: "700", color: colors.muted, textTransform: "capitalize" },

  // Tarjetas del desglose por mes (vista anual)
  monthCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  monthCardEmpty: { opacity: 0.45 },
  monthCardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  monthCardName: { color: colors.text, fontSize: 16, fontWeight: "800", textTransform: "capitalize" },
  monthCardCount: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: colors.cardSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  monthCardCountText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  monthCardStats: { flexDirection: "row", flexWrap: "wrap" },
  monthStat: { width: "50%", paddingVertical: 4, gap: 2 },
  monthStatLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  monthStatValue: { color: colors.text, fontSize: 14, fontWeight: "800", fontVariant: ["tabular-nums"] },

  dayHeader: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    backgroundColor: colors.bg,
    paddingTop: 14,
    paddingBottom: 8,
  },
  movCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 12,
    paddingRight: 13,
    paddingLeft: 12,
    marginBottom: 8,
    overflow: "hidden",
  },
  movBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  movIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  movTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  movDetail: { color: colors.muted, fontSize: 13, marginTop: 2 },
  movChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  movChip: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  movRight: { alignItems: "flex-end", gap: 8 },
  movAmount: { fontSize: 15, fontWeight: "800" },
  movActions: { flexDirection: "row", gap: 14 },
  debtRemaining: { color: colors.greenDark, fontSize: 12.5, fontWeight: "700", marginTop: 4 },
  payDebtBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    marginTop: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#e0b32e",
  },
  payDebtText: { color: "#3a2d05", fontWeight: "800", fontSize: 13 },
});
