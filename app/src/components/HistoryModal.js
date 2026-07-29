import React, { useMemo, useState } from "react";
// (drill-down anual: año -> 12 carpetas de mes -> movimientos del mes)
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { movimientoService } from "../api";
import MovementFormModal from "./MovementFormModal";
import SettlePersonalDebtModal from "./SettlePersonalDebtModal";
import { useTheme } from "../theme";

// Ícono outline por tipo de movimiento (igual que Filtros).
const movementIcon = (m) => {
  if (m.desdeAhorro) return "swap-horizontal-outline";
  if (m.tipo === "ingreso") return "arrow-down-outline";
  if (m.tipo === "ahorro") return "wallet-outline";
  if (m.tipo === "deuda") return "card-outline";
  return "arrow-up-outline"; // egreso
};
import {
  filterMovimientosByCurrency,
  getMovementTypeMeta,
  formatSignedMoney,
  formatMoney,
  summarizeByType,
  getDayKey,
  formatDayLabel,
} from "../utils/finance";

// Agrupa una lista de movimientos por día (desc) en secciones.
const groupByDay = (list) => {
  const map = new Map();
  list
    .slice()
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .forEach((m) => {
      const key = getDayKey(m.fecha);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    });
  return [...map.entries()].map(([key, data]) => ({
    key,
    title: formatDayLabel(data[0].fecha),
    data,
  }));
};

const RANGES = [
  { key: "hoy", label: "Hoy" },
  { key: "mensual", label: "Mensual" },
  { key: "anual", label: "Anual" },
];

const buildRange = (key) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (key === "hoy") {
    return { from: new Date(y, m, now.getDate()), to: new Date(y, m, now.getDate()) };
  }
  if (key === "anual") {
    return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
  }
  return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) };
};

export default function HistoryModal({
  visible,
  movimientos = [],
  currency = "ARS",
  onClose,
  onChanged,
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const [range, setRange] = useState("mensual");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [openMonth, setOpenMonth] = useState(null); // 0-11 dentro de "anual"
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
            onChanged?.();
          } catch {
            Alert.alert("Error", "No se pudo eliminar.");
          }
        },
      },
    ]);
  };

  const { sections, monthCards } = useMemo(() => {
    if (range === "anual") {
      const from = new Date(selectedYear, 0, 1);
      const to = new Date(selectedYear, 11, 31);
      const yearMovs = filterMovimientosByCurrency(movimientos, currency, { from, to });

      if (openMonth !== null) {
        const monthMovs = yearMovs.filter((m) => new Date(m.fecha).getMonth() === openMonth);
        return { sections: groupByDay(monthMovs), monthCards: [] };
      }

      const byMonth = new Map();
      yearMovs.forEach((m) => {
        const mo = new Date(m.fecha).getMonth();
        if (!byMonth.has(mo)) byMonth.set(mo, []);
        byMonth.get(mo).push(m);
      });
      const cards = Array.from({ length: 12 }, (_, mo) => {
        const list = byMonth.get(mo) || [];
        return {
          monthIndex: mo,
          label: new Date(selectedYear, mo, 1).toLocaleDateString("es-AR", { month: "long" }),
          count: list.length,
          summary: summarizeByType(list),
        };
      });
      return { sections: [], monthCards: cards };
    }

    const list = filterMovimientosByCurrency(movimientos, currency, buildRange(range));
    return { sections: groupByDay(list), monthCards: [] };
  }, [movimientos, currency, range, selectedYear, openMonth]);

  const isAnnualGrid = range === "anual" && openMonth === null;
  const isEmpty = isAnnualGrid ? false : sections.length === 0;

  const selectRange = (key) => {
    setRange(key);
    setOpenMonth(null);
  };

  const renderDayList = () =>
    isEmpty ? (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyTitle}>No hay movimientos para mostrar</Text>
        <Text style={styles.emptyText}>
          Cambiá a otra vista o cargá un movimiento para verlo también desde el home.
        </Text>
      </View>
    ) : (
      sections.map((sec) => (
        <View key={sec.key}>
          <Text style={styles.dayHeader}>{sec.title}</Text>
          {sec.data.map((item) => {
            const meta = getMovementTypeMeta(item.tipo);
            const isDebt = item.tipo === "deuda";
            const isPendingDebt = isDebt && item.deudaEstado !== "pagada";
            const debtPaid = Number(item.deudaPagado) || 0;
            const debtRemaining = (Number(item.monto) || 0) - debtPaid;
            const isPartialDebt = isPendingDebt && debtPaid > 0;
            return (
              <View key={item._id} style={styles.movCard}>
                <View
                  style={[
                    styles.movIcon,
                    { borderColor: meta.color + "55", backgroundColor: meta.color + "1f" },
                  ]}
                >
                  <Ionicons name={movementIcon(item)} size={19} color={colors.text} />
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
                    <TouchableOpacity style={styles.payDebtBtn} onPress={() => setSettleDebt(item)}>
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
          })}
        </View>
      ))
    );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.safe, { paddingBottom: insets.bottom }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View>
            <Text style={styles.kicker}>HISTORIAL</Text>
            <Text style={styles.title}>Movimientos · {currency}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Hoy / Mensual / Anual */}
        <View style={styles.tabs}>
          {RANGES.map((r) => {
            const active = range === r.key;
            return (
              <TouchableOpacity
                key={r.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => selectRange(r.key)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 30 }}>
          {isAnnualGrid ? (
            <>
              {/* Selector de año */}
              <View style={styles.yearNav}>
                <TouchableOpacity onPress={() => setSelectedYear((y) => y - 1)} hitSlop={8}>
                  <Ionicons name="chevron-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.yearNavText}>{selectedYear}</Text>
                <TouchableOpacity onPress={() => setSelectedYear((y) => y + 1)} hitSlop={8}>
                  <Ionicons name="chevron-forward" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* 12 carpetas de mes */}
              {monthCards.map((c) => (
                <TouchableOpacity
                  key={c.monthIndex}
                  style={[styles.monthCard, c.count === 0 && styles.monthCardEmpty]}
                  onPress={() => c.count > 0 && setOpenMonth(c.monthIndex)}
                  activeOpacity={c.count > 0 ? 0.85 : 1}
                >
                  <View style={styles.monthCardHead}>
                    <Text style={styles.monthCardName}>{c.label}</Text>
                    <View style={styles.monthCardCount}>
                      <Text style={styles.monthCardCountText}>{c.count}</Text>
                    </View>
                  </View>
                  <View style={styles.monthCardStats}>
                    <View style={styles.monthStat}>
                      <Text style={styles.monthStatLabel}>Ingresos</Text>
                      <Text style={[styles.monthStatValue, { color: colors.greenDark }]}>
                        {formatMoney(c.summary.ingreso, currency)}
                      </Text>
                    </View>
                    <View style={styles.monthStat}>
                      <Text style={styles.monthStatLabel}>Egresos</Text>
                      <Text style={[styles.monthStatValue, { color: colors.red }]}>
                        {formatMoney(c.summary.egreso, currency)}
                      </Text>
                    </View>
                    <View style={styles.monthStat}>
                      <Text style={styles.monthStatLabel}>Ahorro</Text>
                      <Text style={styles.monthStatValue}>
                        {formatMoney(c.summary.ahorro, currency)}
                      </Text>
                    </View>
                    <View style={styles.monthStat}>
                      <Text style={styles.monthStatLabel}>Deuda</Text>
                      <Text
                        style={[
                          styles.monthStatValue,
                          c.summary.deudaPendiente > 0 && { color: colors.red },
                        ]}
                      >
                        {formatMoney(c.summary.deudaPendiente, currency)}
                      </Text>
                    </View>
                    <View style={styles.monthStat}>
                      <Text style={styles.monthStatLabel}>Balance</Text>
                      <Text
                        style={[
                          styles.monthStatValue,
                          { color: c.summary.total >= 0 ? colors.greenDark : colors.red },
                        ]}
                      >
                        {formatMoney(c.summary.total, currency)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          ) : range === "anual" ? (
            <>
              <TouchableOpacity style={styles.backRow} onPress={() => setOpenMonth(null)}>
                <Ionicons name="chevron-back" size={20} color={colors.text} />
                <Text style={styles.backText}>
                  {new Date(selectedYear, openMonth, 1).toLocaleDateString("es-AR", {
                    month: "long",
                  })}{" "}
                  {selectedYear}
                </Text>
              </TouchableOpacity>
              {renderDayList()}
            </>
          ) : (
            renderDayList()
          )}
        </ScrollView>
      </View>

      <MovementFormModal
        visible={Boolean(editMov)}
        editMovement={editMov}
        defaultCurrency={currency}
        movimientos={movimientos}
        onClose={() => setEditMov(null)}
        onSaved={() => {
          setEditMov(null);
          onChanged?.();
        }}
      />

      <SettlePersonalDebtModal
        visible={Boolean(settleDebt)}
        debt={settleDebt}
        onClose={() => setSettleDebt(null)}
        onSaved={() => {
          setSettleDebt(null);
          onChanged?.();
        }}
      />
    </Modal>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    kicker: { color: colors.greenDark, fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
    title: { color: colors.text, fontSize: 19, fontWeight: "800", marginTop: 2 },
    tabs: {
      flexDirection: "row",
      gap: 8,
      padding: 16,
      paddingBottom: 4,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    tabActive: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
    tabText: { color: colors.muted, fontWeight: "800", fontSize: 14 },
    tabTextActive: { color: colors.greenDark },

    emptyBox: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 16,
      padding: 22,
      alignItems: "center",
      marginTop: 10,
    },
    emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
    emptyText: { color: colors.muted, fontSize: 13, marginTop: 8, textAlign: "center", lineHeight: 19 },

    dayHeader: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 10,
      marginBottom: 8,
    },

    // Vista anual: selector de año + carpetas de mes
    yearNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 22,
      paddingVertical: 6,
      marginBottom: 8,
    },
    yearNavText: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
      minWidth: 70,
      textAlign: "center",
    },
    monthFolder: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 14,
      marginBottom: 8,
    },
    monthFolderName: { color: colors.text, fontSize: 15, fontWeight: "800", textTransform: "capitalize" },
    monthFolderSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
    monthFolderAmounts: { alignItems: "flex-end", gap: 2 },
    folderIn: { color: colors.greenDark, fontSize: 12.5, fontWeight: "800", fontVariant: ["tabular-nums"] },
    folderOut: { color: colors.red, fontSize: 12.5, fontWeight: "800", fontVariant: ["tabular-nums"] },

    // Cards de resultados por mes (mismas que la pantalla de Filtros)
    monthCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 16,
      padding: 14,
      gap: 12,
      marginBottom: 10,
    },
    monthCardEmpty: { opacity: 0.45 },
    monthCardHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
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
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      marginBottom: 4,
    },
    backText: { color: colors.text, fontSize: 16, fontWeight: "800", textTransform: "capitalize" },
    movCard: {
      flexDirection: "row",
      alignItems: "flex-start",
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
    movChip: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
    movAmount: { fontSize: 15, fontWeight: "800" },
    movIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
    },
    movRight: { alignItems: "flex-end", gap: 8 },
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
