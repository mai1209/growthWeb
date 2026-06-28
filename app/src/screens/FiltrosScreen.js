import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  SectionList,
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
import { movimientoService } from "../api";
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

export default function FiltrosScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const route = useRoute();
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [month, setMonth] = useState(new Date());
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
      const res = await movimientoService.getAll({ workspace: "personal" });
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

  const { sections, summary } = useMemo(() => {
    const from = new Date(month.getFullYear(), month.getMonth(), 1);
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const monthMovs = filterMovimientosByCurrency(movimientos, currency, { from, to });

    const q = search.trim().toLowerCase();
    const filtered = monthMovs.filter((m) => {
      if (type !== "all" && normalizeMovementType(m.tipo) !== type) return false;
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

    return {
      summary: summarizeByType(filtered),
      sections: [...map.entries()].map(([key, data]) => ({
        title: formatDayLabel(data[0].fecha),
        data,
      })),
    };
  }, [movimientos, currency, month, search, type]);

  const monthLabel = month.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  const summaryCards = [
    { label: "Ingresos", value: formatMoney(summary.ingreso, currency), accent: statAccents.ingreso },
    { label: "Egresos", value: formatMoney(summary.egreso, currency), accent: statAccents.egreso },
    { label: "Ahorros", value: formatMoney(summary.ahorro, currency), accent: statAccents.ahorro },
    { label: "Deuda pend.", value: formatMoney(summary.deudaPendiente, currency), accent: statAccents.deuda },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {/* Mes + ARS/USD + Filtrar */}
      <View style={styles.topBar}>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => setMonth((m) => shiftMonth(m, -1))} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          <TouchableOpacity onPress={() => setMonth((m) => shiftMonth(m, 1))} hitSlop={10}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
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
        </View>
      </View>

      {/* Panel de filtros */}
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
          </View>
          <View style={styles.typeRow}>
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
          </View>
          {(search || type !== "all") && (
            <TouchableOpacity onPress={() => { setSearch(""); setType("all"); }}>
              <Text style={styles.clear}>Limpiar filtros</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 30 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 30 }}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={fetchData} tintColor={colors.green} />
          }
          ListHeaderComponent={
            <View style={styles.summaryGrid}>
              {summaryCards.map((c) => (
                <View key={c.label} style={styles.summaryCard}>
                  <View style={[styles.sumBar, { backgroundColor: c.accent }]} />
                  <Text style={styles.sumLabel}>{c.label}</Text>
                  <Text style={styles.sumValue}>{c.value}</Text>
                </View>
              ))}
            </View>
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
            return (
              <View style={styles.movCard}>
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
                    {item.medio ? <Text style={styles.movChip}>{item.medio}</Text> : null}
                  </View>
                  {isPendingDebt ? (
                    <TouchableOpacity
                      style={styles.payDebtBtn}
                      onPress={() => setSettleDebt(item)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={15} color={colors.greenDark} />
                      <Text style={styles.payDebtText}>Ya lo pagué</Text>
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
  topActions: { flexDirection: "row", alignItems: "center", gap: 10 },
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
  curBtnActive: { backgroundColor: colors.greenSoft },
  curText: { color: colors.muted, fontWeight: "800", fontSize: 13 },
  curTextActive: { color: colors.greenDark },
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
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bg,
  },
  typeChipActive: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
  typeChipText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  typeChipTextActive: { color: colors.greenDark },
  clear: { color: colors.greenDark, fontWeight: "700", fontSize: 13 },

  error: { color: colors.red, padding: 16 },
  empty: { color: colors.muted, padding: 16, textAlign: "center" },

  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  summaryCard: {
    width: "48%",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 12,
    overflow: "hidden",
  },
  sumBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 },
  sumLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  sumValue: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 5 },

  dayHeader: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 8,
  },
  movCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 13,
    marginBottom: 8,
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
    borderWidth: 1,
    borderColor: colors.greenBorder,
    backgroundColor: colors.greenSoft,
  },
  payDebtText: { color: colors.greenDark, fontWeight: "800", fontSize: 13 },
});
