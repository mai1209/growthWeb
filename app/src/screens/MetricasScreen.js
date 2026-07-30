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
import Svg, { Circle, G, Rect, Line, Text as SvgText } from "react-native-svg";
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

const TYPE_COLORS = {
  ingreso: "#9cfb43",
  egreso: "#ff915c",
  ahorro: "#58eba4",
  deuda: "#ffd55c",
};
const CATEGORY_COLORS = ["#9cfb43", "#ff915c", "#58eba4", "#ffd55c", "#69a7ff", "#f070b8"];

const getPeriodRange = (period) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === "year") {
    return { from: new Date(y, 0, 1), to: new Date(y, 11, 31) };
  }
  const back = period === "quarter" ? 2 : period === "semester" ? 5 : 0;
  const from = new Date(y, m - back, 1);
  const to = new Date(y, m + 1, 0);
  return { from, to };
};

// Etiqueta sutil del período que se está contando (ej: "jul 2026", "may – jul 2026").
const periodRangeLabel = (period) => {
  const { from, to } = getPeriodRange(period);
  if (period === "year") return String(from.getFullYear());
  if (period === "month") return from.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
  const f = from.toLocaleDateString("es-AR", { month: "short" });
  const t = to.toLocaleDateString("es-AR", { month: "short", year: "numeric" });
  return `${f} – ${t}`;
};

// Donut con react-native-svg (segmentos por strokeDasharray)
function Donut({ items, size = 132, stroke = 22, colors }) {
  const data = items.filter((i) => i.value > 0);
  const total = data.reduce((a, i) => a + i.value, 0);
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${cx}, ${cx}`}>
          {total === 0 ? (
            <Circle cx={cx} cy={cx} r={r} stroke={colors.cardBorder} strokeWidth={stroke} fill="none" />
          ) : (
            data.map((it, idx) => {
              const len = (it.value / total) * circ;
              const el = (
                <Circle
                  key={idx}
                  cx={cx}
                  cy={cx}
                  r={r}
                  stroke={it.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${len} ${circ - len}`}
                  strokeDashoffset={-acc}
                />
              );
              acc += len;
              return el;
            })
          )}
        </G>
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>{data.length}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>rubros</Text>
      </View>
    </View>
  );
}

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

  const { summary, typeItems, expenseCats, incomeCats, monthlyBuckets } = useMemo(() => {
    const { from, to } = getPeriodRange(period);
    const periodMovs = filterMovimientosByCurrency(movimientos, currency, { from, to });
    const sum = summarizeByType(periodMovs);

    const types = [
      { label: "Ingresos", value: sum.ingreso, color: TYPE_COLORS.ingreso },
      { label: "Egresos", value: sum.egreso, color: TYPE_COLORS.egreso },
      { label: "Ahorros", value: sum.ahorro, color: TYPE_COLORS.ahorro },
      { label: "Deuda pend.", value: sum.deudaPendiente, color: TYPE_COLORS.deuda },
    ];

    const groupBy = (tipo) => {
      const map = new Map();
      periodMovs.forEach((m) => {
        if (normalizeMovementType(m.tipo) !== tipo) return;
        const cat = m.categoria?.trim() || "Sin categoría";
        map.set(cat, (map.get(cat) || 0) + (Number(m.monto) || 0));
      });
      return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([label, value], i) => ({
          label,
          value: Number(value.toFixed(2)),
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        }));
    };

    // Buckets por mes (para el gráfico de velas de "Comparación mensual").
    const byMonth = new Map();
    periodMovs.forEach((m) => {
      const d = new Date(m.fecha);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      if (!byMonth.has(key)) {
        byMonth.set(key, { key, date: new Date(d.getFullYear(), d.getMonth(), 1), movs: [] });
      }
      byMonth.get(key).movs.push(m);
    });
    const buckets = [...byMonth.values()]
      .sort((a, b) => a.date - b.date)
      .map((b) => ({
        key: b.key,
        label: b.date.toLocaleDateString("es-AR", { month: "short" }),
        summary: summarizeByType(b.movs),
      }));

    return {
      summary: sum,
      typeItems: types,
      expenseCats: groupBy("egreso"),
      incomeCats: groupBy("ingreso"),
      monthlyBuckets: buckets,
    };
  }, [movimientos, currency, period]);

  const summaryCards = [
    { label: "Ingresos", value: formatMoney(summary.ingreso, currency), accent: statAccents.ingreso },
    { label: "Egresos", value: formatMoney(summary.egreso, currency), accent: statAccents.egreso },
    { label: "Ahorros", value: formatMoney(summary.ahorro, currency), accent: statAccents.ahorro },
    { label: "Deuda pend.", value: formatMoney(summary.deudaPendiente, currency), accent: statAccents.deuda },
  ];

  const renderChart = (title, items, emptyLabel) => {
    const total = items.reduce((a, i) => a + i.value, 0);
    const data = items.filter((i) => i.value > 0);
    return (
      <>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.card}>
          {total === 0 ? (
            <Text style={styles.muted}>{emptyLabel}</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 6, minWidth: "100%", justifyContent: "center" }}
            >
              {(() => {
                const shown = items.filter((i) => i.value > 0);
                const maxV = Math.max(...shown.map((i) => i.value), 1);
                const COL = 68;
                const TOP = 22;
                const PLOT = 120;
                const H = 178;
                const W = shown.length * COL;
                const yVal = (v) => TOP + PLOT * (1 - v / maxV);
                return (
                  <Svg width={Math.max(W, 1)} height={H}>
                    {[0, 0.5, 1].map((t) => (
                      <Line
                        key={t}
                        x1={0}
                        x2={W}
                        y1={TOP + PLOT * t}
                        y2={TOP + PLOT * t}
                        stroke={colors.cardBorder}
                        strokeWidth={1}
                        opacity={0.5}
                      />
                    ))}
                    {shown.map((it, i) => {
                      const cx = i * COL + COL / 2;
                      const bodyTop = yVal(it.value);
                      const bodyH = Math.max(3, yVal(0) - bodyTop);
                      const pct = ((it.value / total) * 100).toFixed(0);
                      const name = it.label.length > 8 ? `${it.label.slice(0, 7)}…` : it.label;
                      return (
                        <G key={it.label}>
                          <Line
                            x1={cx}
                            x2={cx}
                            y1={yVal(maxV)}
                            y2={yVal(0)}
                            stroke={it.color}
                            strokeWidth={2}
                            opacity={0.28}
                          />
                          <Rect
                            x={cx - 13}
                            y={bodyTop}
                            width={26}
                            height={bodyH}
                            rx={4}
                            fill={it.color}
                          />
                          <SvgText
                            x={cx}
                            y={bodyTop - 6}
                            fontSize={10}
                            fill={colors.text}
                            textAnchor="middle"
                            fontWeight="800"
                          >
                            {`${pct}%`}
                          </SvgText>
                          <SvgText
                            x={cx}
                            y={H - 5}
                            fontSize={9.5}
                            fill={colors.muted}
                            textAnchor="middle"
                            fontWeight="700"
                          >
                            {name}
                          </SvgText>
                        </G>
                      );
                    })}
                  </Svg>
                );
              })()}
            </ScrollView>
          )}
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {/* Header + switches FIJOS */}
      <View style={styles.fixedHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Métricas</Text>
          <Text style={styles.periodLabel} numberOfLines={1}>
            {periodRangeLabel(period)}
          </Text>
        </View>
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

          <View style={styles.periodRow}>
            <View style={styles.periodChips}>
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
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 30 }} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={fetchData} tintColor={colors.green} />
          }
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Totales: fila deslizable (scroll lateral) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.summaryRow}
          >
            {summaryCards.map((c) => (
              <View key={c.label} style={styles.summaryCard}>
                <View style={[styles.sumBar, { backgroundColor: c.accent }]} />
                <Text style={styles.sumLabel}>{c.label}</Text>
                <Text style={styles.sumValue}>{c.value}</Text>
              </View>
            ))}
          </ScrollView>

          {/* Velas por tipo / categoría */}
          {renderChart("Distribución por tipo", typeItems, "Sin datos en este período.")}
          {renderChart("Egresos por categoría", expenseCats, "Sin egresos en este período.")}
          {renderChart("Ingresos por categoría", incomeCats, "Sin ingresos en este período.")}

          {/* Comparación mensual (velas verde/roja por mes) */}
          <Text style={styles.sectionTitle}>Comparación mensual</Text>
          <View style={styles.card}>
            {monthlyBuckets.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 6, minWidth: "100%", justifyContent: "center" }}
              >
                {(() => {
                  const COL = 54;
                  const BODY = 20;
                  const TOP = 12;
                  const PLOT = 150;
                  const H = 190;
                  const W = monthlyBuckets.length * COL;
                  const max =
                    Math.max(
                      1,
                      ...monthlyBuckets.flatMap((b) => [
                        b.summary.ingreso,
                        b.summary.egreso,
                        b.summary.ahorro,
                      ])
                    ) * 1.15;
                  const yVal = (v) => TOP + PLOT * (1 - v / max);
                  return (
                    <Svg width={Math.max(W, 1)} height={H}>
                      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                        <Line
                          key={t}
                          x1={0}
                          x2={W}
                          y1={TOP + PLOT * t}
                          y2={TOP + PLOT * t}
                          stroke={colors.cardBorder}
                          strokeWidth={1}
                          opacity={0.4}
                        />
                      ))}
                      {monthlyBuckets.map((b, i) => {
                        const open = b.summary.egreso;
                        const close = b.summary.ingreso;
                        const high = Math.max(b.summary.ingreso, b.summary.egreso, b.summary.ahorro);
                        const low = Math.min(
                          b.summary.ingreso,
                          b.summary.egreso,
                          b.summary.ahorro,
                          0
                        );
                        const up = close >= open;
                        const color = up ? TYPE_COLORS.ingreso : TYPE_COLORS.egreso;
                        const cx = i * COL + COL / 2;
                        const bodyTop = yVal(Math.max(open, close));
                        const bodyH = Math.max(3, yVal(Math.min(open, close)) - bodyTop);
                        return (
                          <G key={b.key}>
                            <Line x1={cx} x2={cx} y1={yVal(high)} y2={yVal(low)} stroke={color} strokeWidth={2} />
                            <Rect x={cx - BODY / 2} y={bodyTop} width={BODY} height={bodyH} rx={3} fill={color} />
                            <SvgText
                              x={cx}
                              y={H - 6}
                              fontSize={9.5}
                              fill={colors.muted}
                              textAnchor="middle"
                              fontWeight="700"
                            >
                              {b.label}
                            </SvgText>
                          </G>
                        );
                      })}
                    </Svg>
                  );
                })()}
              </ScrollView>
            ) : (
              <Text style={styles.muted}>Sin datos para graficar en este período.</Text>
            )}
          </View>

          {/* Ranking: categorías con mayor egreso (donut) */}
          <Text style={styles.sectionTitle}>Categorías con mayor egreso</Text>
          <View style={styles.card}>
            {expenseCats.length ? (
              <View style={styles.chartLayout}>
                <Donut items={expenseCats} colors={colors} />
                <View style={styles.legend}>
                  {expenseCats.map((it) => (
                    <View key={it.label} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: it.color }]} />
                      <Text style={[styles.legendLabel, { flex: 1 }]} numberOfLines={1}>
                        {it.label}
                      </Text>
                      <Text style={styles.legendPct}>{formatMoney(it.value, currency)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text style={styles.muted}>No hay egresos en este período.</Text>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    fixedHeader: {
      paddingHorizontal: 16,
      paddingTop: 2,
      paddingBottom: 12,
      gap: 12,
      backgroundColor: colors.bg,
    },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    title: { color: colors.text, fontSize: 20, fontWeight: "800" },
    content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 30, gap: 12 },
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
    curBtnActive: { backgroundColor: colors.segActive },
    curText: { color: colors.muted, fontWeight: "800", fontSize: 13 },
    curTextActive: { color: colors.segActiveText },

    periodRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    periodChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, flexShrink: 1 },
    periodLabel: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "capitalize",
      opacity: 0.7,
      marginLeft: "auto",
    },
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

    summaryRow: { flexDirection: "row", gap: 10, paddingRight: 4 },
    summaryCard: {
      minWidth: 150,
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
    },
    muted: { color: colors.muted, fontSize: 13 },

    chartLayout: { flexDirection: "row", alignItems: "center", gap: 14 },
    legend: { flex: 1, gap: 9 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
    legendDot: { width: 11, height: 11, borderRadius: 3 },
    legendLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
    legendAmt: { color: colors.muted, fontSize: 11, marginTop: 1 },
    legendPct: { color: colors.text, fontSize: 13, fontWeight: "800" },
  });
