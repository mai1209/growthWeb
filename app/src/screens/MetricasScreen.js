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
import { movimientoService } from "../api";
import { statAccents, useTheme } from "../theme";
import {
  CURRENCY_OPTIONS,
  filterMovimientosByCurrency,
  summarizeByType,
  formatMoney,
  normalizeMovementType,
} from "../utils/finance";

const PERIOD_OPTIONS = [
  { value: "month", label: "Mes" },
  { value: "quarter", label: "3 meses" },
  { value: "semester", label: "6 meses" },
  { value: "year", label: "Año" },
];

const getPeriodRange = (period) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === "year") {
    return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
  }
  const back = period === "quarter" ? 2 : period === "semester" ? 5 : 0;
  const from = new Date(y, m - back, 1);
  const to = new Date(y, m + 1, 0); // último día del mes actual
  return { from, to };
};

export default function MetricasScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [period, setPeriod] = useState("month");

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

  const { summary, distribution, topEgresos, topIngresos } = useMemo(() => {
    const { from, to } = getPeriodRange(period);
    const periodMovs = filterMovimientosByCurrency(movimientos, currency, { from, to });
    const sum = summarizeByType(periodMovs);

    const dist = [
      { key: "ingreso", label: "Ingresos", value: sum.ingreso, accent: statAccents.ingreso },
      { key: "egreso", label: "Egresos", value: sum.egreso, accent: statAccents.egreso },
      { key: "ahorro", label: "Ahorros", value: sum.ahorro, accent: statAccents.ahorro },
    ];

    const groupBy = (tipo) => {
      const map = new Map();
      periodMovs.forEach((m) => {
        if (normalizeMovementType(m.tipo) !== tipo) return;
        const cat = m.categoria || "Sin categoría";
        map.set(cat, (map.get(cat) || 0) + (Number(m.monto) || 0));
      });
      return [...map.entries()]
        .map(([categoria, total]) => ({ categoria, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    };

    return {
      summary: sum,
      distribution: dist,
      topEgresos: groupBy("egreso"),
      topIngresos: groupBy("ingreso"),
    };
  }, [movimientos, currency, period]);

  const summaryCards = [
    { label: "Ingresos", value: formatMoney(summary.ingreso, currency), accent: statAccents.ingreso },
    { label: "Egresos", value: formatMoney(summary.egreso, currency), accent: statAccents.egreso },
    { label: "Ahorros", value: formatMoney(summary.ahorro, currency), accent: statAccents.ahorro },
    { label: "Deuda pend.", value: formatMoney(summary.deudaPendiente, currency), accent: statAccents.deuda },
  ];

  const distMax = Math.max(...distribution.map((d) => d.value), 0);
  const distEmpty = distMax <= 0;

  const renderRankRows = (rows, accent) => {
    if (!rows.length) {
      return <Text style={styles.muted}>Sin datos en este período.</Text>;
    }
    const top = rows[0].total || 1;
    return rows.map((r) => {
      const pct = top > 0 ? Math.min((r.total / top) * 100, 100) : 0;
      return (
        <View key={r.categoria} style={styles.barRow}>
          <View style={styles.barHead}>
            <Text style={styles.barLabel} numberOfLines={1}>{r.categoria}</Text>
            <Text style={styles.barValue}>{formatMoney(r.total, currency)}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%`, backgroundColor: accent }]} />
          </View>
        </View>
      );
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {/* A. Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Métricas</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={fetchData} tintColor={colors.green} />
          }
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* B. Switch de moneda */}
          <View style={styles.controls}>
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

            {/* C. Switch de período */}
            <View style={styles.periodRow}>
              {PERIOD_OPTIONS.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.periodChip, period === p.value && styles.periodChipActive]}
                  onPress={() => setPeriod(p.value)}
                >
                  <Text style={[styles.periodChipText, period === p.value && styles.periodChipTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* E. Totales */}
          <View style={styles.summaryGrid}>
            {summaryCards.map((c) => (
              <View key={c.label} style={styles.summaryCard}>
                <View style={[styles.sumBar, { backgroundColor: c.accent }]} />
                <Text style={styles.sumLabel}>{c.label}</Text>
                <Text style={styles.sumValue}>{c.value}</Text>
              </View>
            ))}
          </View>

          {/* F. Distribución */}
          <Text style={styles.sectionTitle}>Distribución</Text>
          <View style={styles.card}>
            {distEmpty ? (
              <Text style={styles.muted}>Sin datos en este período.</Text>
            ) : (
              distribution.map((d) => {
                const pct = distMax > 0 ? Math.min((d.value / distMax) * 100, 100) : 0;
                return (
                  <View key={d.key} style={styles.barRow}>
                    <View style={styles.barHead}>
                      <Text style={styles.barLabel}>{d.label}</Text>
                      <Text style={styles.barValue}>{formatMoney(d.value, currency)}</Text>
                    </View>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: d.accent }]} />
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* G. Mayores egresos */}
          <Text style={styles.sectionTitle}>Mayores egresos</Text>
          <View style={styles.card}>{renderRankRows(topEgresos, statAccents.egreso)}</View>

          {/* H. Mayores ingresos */}
          <Text style={styles.sectionTitle}>Mayores ingresos</Text>
          <View style={styles.card}>{renderRankRows(topIngresos, statAccents.ingreso)}</View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },

  content: { padding: 16, paddingBottom: 30, gap: 12 },
  error: { color: colors.red },

  controls: { gap: 10 },
  currencySwitch: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: 4,
    alignSelf: "flex-start",
  },
  curBtn: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 9 },
  curBtnActive: { backgroundColor: colors.greenSoft },
  curText: { color: colors.muted, fontWeight: "800", fontSize: 13 },
  curTextActive: { color: colors.greenDark },

  periodRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  periodChip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bg,
  },
  periodChipActive: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
  periodChipText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  periodChipTextActive: { color: colors.greenDark },

  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
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

  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 6,
  },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  muted: { color: colors.muted, fontSize: 13 },

  barRow: { gap: 6 },
  barHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  barLabel: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
  barValue: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#d7e0d6",
    overflow: "hidden",
  },
  fill: { height: 8, borderRadius: 999 },
});
