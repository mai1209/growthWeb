// Métricas de la app — mismo formato que la web rediseñada ("lila" con la
// paleta de la app): KPIs con chip de ícono, Composición en barras
// horizontales con %, Ingresos/Gastos por categoría como anillos (100% al
// centro y la categoría principal debajo), Evolución como línea diaria suave
// con puntos verde/rojo, y Ranking como lista numerada con toggle.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { movimientoService } from "../api";
import { useTheme } from "../theme";
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
const NEGATIVO = "#ff6e6e";
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

const truncLabel = (value, max = 12) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

// Anillo por categorías: 100% al centro (segmentos por strokeDasharray)
function Ring({ items, size = 132, stroke = 20, colors }) {
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
                  strokeLinecap="butt"
                />
              );
              acc += len;
              return el;
            })
          )}
        </G>
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "900" }}>100%</Text>
      </View>
    </View>
  );
}

export default function MetricasScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const styles = makeStyles(colors);
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [period, setPeriod] = useState("month");
  const [rankingType, setRankingType] = useState("egreso");

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

  const { summary, typeItems, expenseCats, incomeCats, dailySeries } = useMemo(() => {
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
        .slice(0, 8)
        .map(([label, value], i) => ({
          label,
          value: Number(value.toFixed(2)),
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        }));
    };

    // Evolución DIARIA del balance dentro del período, cortada en hoy
    // (misma lógica que la web: siempre hay línea completa a lo ancho).
    const byDay = new Map();
    periodMovs.forEach((m) => {
      let delta = 0;
      const tipo = normalizeMovementType(m.tipo);
      if (tipo === "ingreso") delta = Number(m.monto) || 0;
      else if (tipo === "egreso" || tipo === "ahorro") delta = -(Number(m.monto) || 0);
      else return;
      const key = String(m.fecha).slice(0, 10);
      byDay.set(key, (byDay.get(key) || 0) + delta);
    });
    const today = new Date();
    const end = to < today ? to : today;
    const days = [];
    let acc = 0;
    const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    while (cursor <= end && days.length < 400) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const delta = byDay.get(key) || 0;
      acc += delta;
      days.push({
        key,
        label: cursor.toLocaleDateString("es-AR", { day: "numeric", month: "short" }),
        balance: Number(acc.toFixed(2)),
        delta,
        hasMov: byDay.has(key),
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      summary: sum,
      typeItems: types,
      expenseCats: groupBy("egreso"),
      incomeCats: groupBy("ingreso"),
      dailySeries: days,
    };
  }, [movimientos, currency, period]);

  const totalTypeAmount = typeItems.reduce((a, i) => a + i.value, 0);
  const compositionItems = typeItems.filter((i) => i.value > 0);

  const rankingItems = rankingType === "egreso" ? expenseCats : incomeCats;
  const rankingTotal = rankingType === "egreso" ? summary.egreso : summary.ingreso;

  const summaryCards = [
    {
      label: "Balance",
      value: formatMoney(summary.total, currency),
      icon: "pulse-outline",
      tint: "#69a7ff",
    },
    {
      label: "Ingresos",
      value: formatMoney(summary.ingreso, currency),
      icon: "trending-up-outline",
      tint: TYPE_COLORS.ingreso,
    },
    {
      label: "Egresos",
      value: formatMoney(summary.egreso, currency),
      icon: "trending-down-outline",
      tint: TYPE_COLORS.egreso,
    },
    {
      label: "Deuda pend.",
      value: formatMoney(summary.deudaPendiente, currency),
      icon: "time-outline",
      tint: TYPE_COLORS.deuda,
    },
  ];

  // Card de anillo por categorías (100% centro + categoría principal debajo)
  const renderRingCard = (title, items, emptyLabel) => {
    const shown = items.filter((i) => i.value > 0);
    const total = shown.reduce((a, i) => a + i.value, 0);
    return (
      <>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.card}>
          {total === 0 ? (
            <Text style={styles.muted}>{emptyLabel}</Text>
          ) : (
            <View style={styles.ringLayout}>
              <View style={{ alignItems: "center", gap: 8 }}>
                <Ring items={shown} colors={colors} />
                <Text style={styles.ringTopCat} numberOfLines={1}>
                  {shown[0].label}
                </Text>
              </View>
              <View style={styles.legend}>
                {shown.slice(0, 5).map((it) => (
                  <View key={it.label} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: it.color }]} />
                    <Text style={[styles.legendLabel, { flex: 1 }]} numberOfLines={1}>
                      {it.label}
                    </Text>
                    <Text style={styles.legendPct}>
                      {((it.value / total) * 100).toFixed(0)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </>
    );
  };

  // Línea diaria suave (evolución del balance)
  const renderDailyLine = () => {
    if (dailySeries.length < 2) {
      return <Text style={styles.muted}>Sin datos para graficar en este período.</Text>;
    }
    const W = width - 32 - 28; // pantalla - padding del contenido - padding de la card
    const H = 190;
    const PADX = 14;
    const TOP = 30;
    const BOT = 30;
    const vals = dailySeries.map((d) => d.balance);
    const maxV = Math.max(...vals, 0);
    const minV = Math.min(...vals, 0);
    const span = maxV - minV || 1;
    const plot = H - TOP - BOT;
    const xFor = (i) => PADX + ((W - PADX * 2) * i) / (dailySeries.length - 1);
    const yFor = (v) => TOP + plot * (1 - (v - minV) / span);
    const pts = dailySeries.map((d, i) => ({ x: xFor(i), y: yFor(d.balance), d }));
    const path = pts
      .map((p, i) => {
        if (i === 0) return `M ${p.x} ${p.y}`;
        const prev = pts[i - 1];
        const mx = (prev.x + p.x) / 2;
        return `C ${mx} ${prev.y}, ${mx} ${p.y}, ${p.x} ${p.y}`;
      })
      .join(" ");
    const movPts = pts.filter((p) => p.d.hasMov);
    const showDots = movPts.length > 0 && movPts.length <= 40;
    const axisIdx = [
      ...new Set([
        0,
        Math.round((dailySeries.length - 1) / 2),
        dailySeries.length - 1,
      ]),
    ];
    return (
      <Svg width={W} height={H}>
        <Line
          x1={PADX}
          x2={W - PADX}
          y1={yFor(0)}
          y2={yFor(0)}
          stroke={colors.cardBorder}
          strokeWidth={1}
          strokeDasharray="4 5"
        />
        <Path d={path} fill="none" stroke={colors.greenBright} strokeWidth={3} strokeLinecap="round" />
        {showDots
          ? movPts.map((p) => (
              <Circle
                key={p.d.key}
                cx={p.x}
                cy={p.y}
                r={5.5}
                fill={p.d.delta >= 0 ? TYPE_COLORS.ingreso : NEGATIVO}
                stroke={colors.card}
                strokeWidth={2.5}
              />
            ))
          : null}
        {axisIdx.map((i) => (
          <SvgText
            key={`x-${pts[i].d.key}`}
            x={pts[i].x}
            y={H - 6}
            fontSize={9.5}
            fill={colors.muted}
            textAnchor={i === 0 ? "start" : i === dailySeries.length - 1 ? "end" : "middle"}
            fontWeight="700"
          >
            {pts[i].d.label}
          </SvgText>
        ))}
      </Svg>
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

          {/* KPIs en grilla 2x2 con chip de ícono */}
          <View style={styles.summaryGrid}>
            {summaryCards.map((c) => (
              <View key={c.label} style={styles.summaryCard}>
                <View style={styles.sumHead}>
                  <Text style={styles.sumLabel} numberOfLines={1}>
                    {c.label}
                  </Text>
                  <View style={[styles.sumIcon, { backgroundColor: `${c.tint}29` }]}>
                    <Ionicons name={c.icon} size={15} color={c.tint} />
                  </View>
                </View>
                <Text style={styles.sumValue} numberOfLines={1} adjustsFontSizeToFit>
                  {c.value}
                </Text>
              </View>
            ))}
          </View>

          {/* Composición en barras horizontales con % */}
          <Text style={styles.sectionTitle}>Composición</Text>
          <View style={styles.card}>
            {compositionItems.length === 0 ? (
              <Text style={styles.muted}>Sin datos en este período.</Text>
            ) : (
              <View style={{ gap: 12 }}>
                {compositionItems.map((it) => {
                  const pct = (it.value / totalTypeAmount) * 100;
                  return (
                    <View key={it.label} style={{ gap: 4 }}>
                      <Text style={styles.compLabel}>{it.label}</Text>
                      <View style={styles.compLine}>
                        <View style={styles.compTrack}>
                          <View
                            style={[
                              styles.compFill,
                              { width: `${Math.max(2, pct)}%`, backgroundColor: it.color },
                            ]}
                          />
                        </View>
                        <Text style={styles.compPct}>{pct.toFixed(1)}%</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Anillos por categoría */}
          {renderRingCard("Ingresos por categoría", incomeCats, "Sin ingresos en este período.")}
          {renderRingCard("Gastos por categoría", expenseCats, "Sin egresos en este período.")}

          {/* Evolución diaria del balance */}
          <Text style={styles.sectionTitle}>Evolución</Text>
          <View style={styles.card}>
            {renderDailyLine()}
            <View style={styles.lineLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: TYPE_COLORS.ingreso }]} />
                <Text style={styles.legendMutedText}>Día con saldo a favor</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: NEGATIVO }]} />
                <Text style={styles.legendMutedText}>Día con más gastos</Text>
              </View>
            </View>
          </View>

          {/* Ranking en lista numerada con toggle */}
          <View style={styles.rankHeader}>
            <Text
              style={[styles.sectionTitle, { flex: 1, marginTop: 0, fontSize: 10, letterSpacing: 0.2 }]}
              numberOfLines={2}
            >
              {rankingType === "egreso" ? "Categorías con mayor egreso" : "Categorías con mayor ingreso"}
            </Text>
            <View style={styles.rankSwitch}>
              {[
                ["egreso", "Egresos"],
                ["ingreso", "Ingresos"],
              ].map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.rankSwitchBtn, rankingType === value && styles.rankSwitchOn]}
                  onPress={() => setRankingType(value)}
                >
                  <Text
                    style={[
                      styles.rankSwitchText,
                      rankingType === value && styles.rankSwitchTextOn,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.card}>
            {rankingItems.length === 0 ? (
              <Text style={styles.muted}>
                No hay {rankingType === "egreso" ? "egresos" : "ingresos"} en este período.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {rankingItems.map((it, index) => (
                  <View key={it.label} style={styles.rankRow}>
                    <View style={styles.rankChip}>
                      <Text style={styles.rankChipText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.rankName} numberOfLines={1}>
                      {truncLabel(it.label, 18)}
                    </Text>
                    <Text style={styles.rankAmt}>
                      {formatMoney(it.value, currency)}
                      <Text style={styles.rankPct}>
                        {"  "}
                        {rankingTotal ? ((it.value / rankingTotal) * 100).toFixed(1) : 0}%
                      </Text>
                    </Text>
                  </View>
                ))}
              </View>
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

    // KPIs 2x2
    summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    summaryCard: {
      flexBasis: "47%",
      flexGrow: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 13,
      gap: 6,
    },
    sumHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
    sumIcon: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    sumLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      flexShrink: 1,
    },
    sumValue: { color: colors.text, fontSize: 17, fontWeight: "800" },

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

    // Composición (barras)
    compLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    compLine: { flexDirection: "row", alignItems: "center", gap: 10 },
    compTrack: {
      flex: 1,
      height: 11,
      borderRadius: 999,
      backgroundColor: colors.cardBorder,
      overflow: "hidden",
    },
    compFill: { height: "100%", borderRadius: 999 },
    compPct: {
      color: colors.text,
      fontSize: 12.5,
      fontWeight: "800",
      minWidth: 48,
      textAlign: "right",
      fontVariant: ["tabular-nums"],
    },

    // Anillos
    ringLayout: { flexDirection: "row", alignItems: "center", gap: 16 },
    ringTopCat: { color: colors.text, fontSize: 13, fontWeight: "800", maxWidth: 132 },
    legend: { flex: 1, gap: 9 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
    legendDot: { width: 11, height: 11, borderRadius: 999 },
    legendLabel: { color: colors.muted, fontSize: 13, fontWeight: "700" },
    legendPct: { color: colors.text, fontSize: 13, fontWeight: "800" },
    legendMutedText: { color: colors.muted, fontSize: 12 },

    // Evolución
    lineLegend: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 8 },

    // Ranking
    rankHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginTop: 6,
    },
    rankSwitch: {
      flexDirection: "row",
      gap: 3,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 999,
      padding: 3,
    },
    rankSwitchBtn: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999 },
    rankSwitchOn: { backgroundColor: colors.segActive },
    rankSwitchText: { color: colors.muted, fontWeight: "800", fontSize: 11.5 },
    rankSwitchTextOn: { color: colors.segActiveText },
    rankRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: colors.cardSoft,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 11,
    },
    rankChip: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: colors.greenSoft,
      borderWidth: 1,
      borderColor: colors.greenBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    rankChipText: { color: colors.greenDark, fontSize: 12, fontWeight: "800" },
    rankName: { flex: 1, color: colors.text, fontSize: 13.5, fontWeight: "700" },
    rankAmt: { color: colors.text, fontSize: 13.5, fontWeight: "800", fontVariant: ["tabular-nums"] },
    rankPct: { color: colors.muted, fontSize: 11.5, fontWeight: "700" },
  });
