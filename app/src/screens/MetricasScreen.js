// Métricas de la app — copia del formato de la web: un panel único con líneas
// divisorias (sin tarjetas con relleno), KPIs con chip de ícono y subtexto,
// Composición en barras horizontales con %, Ingresos/Gastos por categoría como
// gráfico de RADAR (una punta por categoría) con leyenda color · categoría ·
// % · monto, Evolución como línea diaria suave con puntos verde/rojo y la
// etiqueta del último día, y Ranking como lista numerada con toggle.
// Arriba: período (Mes / 3 meses / 6 meses / Año) + calendario para elegir
// el mes (o el año) que se está mirando.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";
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

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const mesLabel = (d) => `${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;

// Igual que la web: el mes elegido es el ÚLTIMO del período (3 meses = ese
// mes y los dos anteriores); en "Año" se usa el año elegido completo.
const getPeriodRange = (period, monthDate, year) => {
  if (period === "year") {
    return { from: new Date(year, 0, 1), to: new Date(year, 11, 31), label: String(year) };
  }
  const y = monthDate.getFullYear();
  const m = monthDate.getMonth();
  const back = period === "quarter" ? 2 : period === "semester" ? 5 : 0;
  const from = new Date(y, m - back, 1);
  const to = new Date(y, m + 1, 0);
  return {
    from,
    to,
    label: back === 0 ? mesLabel(from) : `${MESES_CORTOS[from.getMonth()]} – ${mesLabel(to)}`,
  };
};

const truncLabel = (value, max = 12) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;

// Encabezado de cada bloque, como en la web: rótulo verde + título + dato a la derecha
function BlockHeader({ kicker, title, right, styles }) {
  return (
    <View style={styles.blockHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.blockTitle}>{title}</Text>
      </View>
      {typeof right === "string" ? <Text style={styles.blockRight}>{right}</Text> : right}
    </View>
  );
}

// Barras horizontales con % (Composición, y categorías cuando hay menos de 3)
function BarList({ items, total, styles }) {
  return (
    <View style={{ gap: 12 }}>
      {items.map((it) => {
        const pct = total ? (it.value / total) * 100 : 0;
        return (
          <View key={it.label} style={{ gap: 5 }}>
            <Text style={styles.compLabel}>{it.label}</Text>
            <View style={styles.compLine}>
              <View style={styles.compTrack}>
                <View
                  style={[styles.compFill, { width: `${Math.max(2, pct)}%`, backgroundColor: it.color }]}
                />
              </View>
              <Text style={styles.compPct}>{pct.toFixed(1)}%</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// Radar por categorías (mismo dibujo que la web): anillos + ejes, polígono
// verde translúcido, un punto de color por categoría y su nombre en la punta.
function Radar({ items, colors, size }) {
  const n = items.length;
  const W = size;
  const H = Math.round(size * 0.86);
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W * 0.3, H * 0.36);
  const maxValue = Math.max(...items.map((i) => i.value), 0);
  const angleFor = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pointFor = (i, radius) => ({
    x: cx + radius * Math.cos(angleFor(i)),
    y: cy + radius * Math.sin(angleFor(i)),
  });
  const ring = (ratio) =>
    items
      .map((_, i) => {
        const p = pointFor(i, R * ratio);
        return `${p.x},${p.y}`;
      })
      .join(" ");
  const valuePoints = items.map((it, i) => pointFor(i, maxValue ? (it.value / maxValue) * R : 0));

  return (
    <Svg width={W} height={H}>
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <Polygon key={ratio} points={ring(ratio)} fill="none" stroke={colors.cardBorder} strokeWidth={1} />
      ))}
      {items.map((it, i) => {
        const p = pointFor(i, R);
        return (
          <Line key={`eje-${it.label}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={colors.cardBorder} strokeWidth={1} />
        );
      })}
      <Polygon
        points={valuePoints.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="rgba(156, 251, 67, 0.22)"
        stroke={colors.greenBright2}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {valuePoints.map((p, i) => (
        <Circle
          key={`pt-${items[i].label}`}
          cx={p.x}
          cy={p.y}
          r={4}
          fill={items[i].color}
          stroke={colors.bg}
          strokeWidth={1.5}
        />
      ))}
      {items.map((it, i) => {
        const p = pointFor(i, R + 14);
        const cos = Math.cos(angleFor(i));
        const anchor = Math.abs(cos) < 0.35 ? "middle" : cos > 0 ? "start" : "end";
        return (
          <SvgText
            key={`lbl-${it.label}`}
            x={p.x}
            y={p.y + 3.5}
            fontSize={10}
            fontFamily="Menda-Medium"
            fill={colors.muted}
            textAnchor={anchor}
          >
            {truncLabel(it.label, 11)}
          </SvgText>
        );
      })}
    </Svg>
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
  // Mes que se está mirando (día 1) y año para la vista "Año"
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());

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

  const range = useMemo(() => getPeriodRange(period, monthDate, year), [period, monthDate, year]);

  // No se puede ir más allá del mes / año actual
  const hoy = new Date();
  const enTope =
    period === "year"
      ? year >= hoy.getFullYear()
      : monthDate.getFullYear() * 12 + monthDate.getMonth() >= hoy.getFullYear() * 12 + hoy.getMonth();

  const mover = (dir) => {
    if (dir > 0 && enTope) return;
    if (period === "year") setYear((y) => y + dir);
    else setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  };

  const abrirCalendario = () => {
    setPickerYear(period === "year" ? year : monthDate.getFullYear());
    setPickerOpen(true);
  };

  const { summary, typeItems, expenseCats, incomeCats, dailySeries, egresosCount } = useMemo(() => {
    const { from, to } = range;
    const periodMovs = filterMovimientosByCurrency(movimientos, currency, { from, to });
    const sum = summarizeByType(periodMovs);

    const types = [
      { label: "Ingresos", value: sum.ingreso, color: TYPE_COLORS.ingreso },
      { label: "Egresos", value: sum.egreso, color: TYPE_COLORS.egreso },
      { label: "Ahorros", value: sum.ahorro, color: TYPE_COLORS.ahorro },
      { label: "Deuda pendiente", value: sum.deudaPendiente, color: TYPE_COLORS.deuda },
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
        label: `${cursor.getDate()} ${MESES_CORTOS[cursor.getMonth()]}`,
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
      egresosCount: periodMovs.filter((m) => normalizeMovementType(m.tipo) === "egreso").length,
    };
  }, [movimientos, currency, range]);

  const totalTypeAmount = typeItems.reduce((a, i) => a + i.value, 0);
  const compositionItems = typeItems.filter((i) => i.value > 0);

  const rankingItems = rankingType === "egreso" ? expenseCats : incomeCats;
  const rankingTotal = rankingType === "egreso" ? summary.egreso : summary.ingreso;

  // Mismos 4 KPIs (y mismos subtextos) que la web
  const summaryCards = [
    {
      label: "Balance",
      value: formatMoney(summary.total, currency),
      sub: "Ingresos menos egresos y ahorro.",
      icon: "logo-usd",
      tint: "#69a7ff",
    },
    {
      label: "Ingresos",
      value: formatMoney(summary.ingreso, currency),
      sub: `${totalTypeAmount ? ((summary.ingreso / totalTypeAmount) * 100).toFixed(1) : 0}% del flujo.`,
      icon: "trending-up-outline",
      tint: TYPE_COLORS.ingreso,
    },
    {
      label: "Egresos",
      value: formatMoney(summary.egreso, currency),
      sub: `${egresosCount} movimientos.`,
      icon: "trending-down-outline",
      tint: TYPE_COLORS.egreso,
    },
    {
      label: "Deuda pendiente",
      value: formatMoney(summary.deudaPendiente, currency),
      sub: `${summary.deudaPendienteCount || 0} registros abiertos.`,
      icon: "time-outline",
      tint: TYPE_COLORS.deuda,
    },
  ];

  const anchoBloque = width - 32 - 2 - 32; // pantalla - márgenes - borde - padding del bloque

  // Bloque de radar por categorías + leyenda (color · categoría · % · monto)
  const renderRadarBlock = (kicker, title, items, emptyLabel) => {
    const shown = items.filter((i) => i.value > 0);
    const total = shown.reduce((a, i) => a + i.value, 0);
    return (
      <View style={styles.block}>
        <BlockHeader kicker={kicker} title={title} right={total ? "100%" : "0%"} styles={styles} />
        {shown.length >= 3 ? (
          <>
            <View style={{ alignItems: "center" }}>
              <Radar items={shown} colors={colors} size={Math.min(anchoBloque, 340)} />
            </View>
            <View style={styles.radarLegend}>
              {shown.map((it) => (
                <View key={it.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: it.color }]} />
                  <Text style={styles.legendLabel} numberOfLines={1}>
                    {it.label}
                  </Text>
                  <Text style={styles.legendPct}>{((it.value / total) * 100).toFixed(0)}%</Text>
                  <Text style={styles.legendValue}>{formatMoney(it.value, currency)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : total ? (
          // Con menos de 3 categorías un polígono no dice nada: barras
          <BarList items={shown} total={total} styles={styles} />
        ) : (
          <Text style={styles.muted}>{emptyLabel}</Text>
        )}
      </View>
    );
  };

  // Línea diaria suave (evolución del balance) con la etiqueta del último día
  const renderDailyLine = () => {
    if (dailySeries.length < 2) {
      return <Text style={styles.muted}>Sin datos para graficar en este período.</Text>;
    }
    const W = anchoBloque;
    const H = 200;
    const PADX = 14;
    const TOP = 34;
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
    const last = pts[pts.length - 1];
    const tagW = 64;
    const tagX = Math.min(W - tagW - 2, Math.max(2, last.x - tagW / 2));
    const tagY = last.y - 32 < 2 ? last.y + 12 : last.y - 32;
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
        <Path d={path} fill="none" stroke={colors.greenBright2} strokeWidth={3} strokeLinecap="round" />
        {showDots
          ? movPts.map((p) => (
              <Circle
                key={p.d.key}
                cx={p.x}
                cy={p.y}
                r={5.5}
                fill={p.d.delta >= 0 ? TYPE_COLORS.ingreso : NEGATIVO}
                stroke={colors.bg}
                strokeWidth={2.5}
              />
            ))
          : null}
        <G>
          <Rect
            x={tagX}
            y={tagY}
            width={tagW}
            height={21}
            rx={8}
            fill={colors.card}
            stroke={colors.cardBorder}
            strokeWidth={1}
          />
          <SvgText
            x={tagX + tagW / 2}
            y={tagY + 14.5}
            fontSize={10.5}
            fontFamily="Menda-Bold"
            fill={colors.text}
            textAnchor="middle"
          >
            {last.d.label}
          </SvgText>
        </G>
        {axisIdx.map((i) => (
          <SvgText
            key={`x-${pts[i].d.key}`}
            x={pts[i].x}
            y={H - 6}
            fontSize={9.5}
            fontFamily="Menda-Medium"
            fill={colors.muted}
            textAnchor={i === 0 ? "start" : i === dailySeries.length - 1 ? "end" : "middle"}
          >
            {pts[i].d.label}
          </SvgText>
        ))}
      </Svg>
    );
  };

  const hoyAnio = hoy.getFullYear();
  const hoyMes = hoy.getMonth();

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {/* Header FIJO: título + moneda, períodos y calendario */}
      <View style={styles.fixedHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Métricas</Text>
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
        </View>

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

        {/* Calendario: flechas para ir mes a mes (o año a año) y, tocando la
            fecha, el selector para saltar directo a cualquier mes */}
        <View style={styles.calRow}>
          <TouchableOpacity style={styles.calArrow} onPress={() => mover(-1)} hitSlop={8}>
            <Ionicons name="chevron-back" size={17} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.calLabelBtn} onPress={abrirCalendario} activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={14} color={colors.greenBright2} />
            <Text style={styles.calLabel} numberOfLines={1}>
              {range.label}
            </Text>
            <Ionicons name="chevron-down" size={13} color={colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.calArrow, enTope && { opacity: 0.3 }]}
            onPress={() => mover(1)}
            disabled={enTope}
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={17} color={colors.text} />
          </TouchableOpacity>
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

          {/* Panel ÚNICO como la web: todo sobre el mismo fondo, separado por líneas */}
          <View style={styles.panel}>
            {/* KPIs 2x2 con chip de ícono y subtexto */}
            <View style={styles.summaryGrid}>
              {summaryCards.map((c, i) => (
                <View
                  key={c.label}
                  style={[
                    styles.summaryCard,
                    i % 2 === 0 && styles.summaryCardLeft,
                    i < 2 && styles.summaryCardTop,
                  ]}
                >
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
                  <Text style={styles.sumSub} numberOfLines={2}>
                    {c.sub}
                  </Text>
                </View>
              ))}
            </View>

            {/* Composición en barras horizontales con % */}
            <View style={styles.block}>
              <BlockHeader
                kicker="Composición"
                title="Ingresos, gastos, ahorro y deuda"
                right={compositionItems.length ? "100%" : "0%"}
                styles={styles}
              />
              {compositionItems.length === 0 ? (
                <Text style={styles.muted}>No hay movimientos en este corte.</Text>
              ) : (
                <BarList items={compositionItems} total={totalTypeAmount} styles={styles} />
              )}
            </View>

            {/* Radares por categoría */}
            {renderRadarBlock(
              "Ingresos por categoría",
              "De dónde entró la plata",
              incomeCats,
              "No hay ingresos para graficar."
            )}
            {renderRadarBlock(
              "Gastos por categoría",
              "Dónde se fue la plata",
              expenseCats,
              "No hay egresos para graficar."
            )}

            {/* Evolución diaria del balance */}
            <View style={styles.block}>
              <BlockHeader
                kicker="Evolución"
                title="Cómo se movió tu saldo en el período"
                styles={styles}
              />
              {renderDailyLine()}
              {dailySeries.length > 1 ? (
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
              ) : null}
            </View>

            {/* Ranking: lista numerada plana con toggle */}
            <View style={styles.block}>
              <BlockHeader
                kicker="Ranking"
                title={
                  rankingType === "egreso"
                    ? "Categorías con mayor egreso"
                    : "Categorías con mayor ingreso"
                }
                right={
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
                }
                styles={styles}
              />
              {rankingItems.length === 0 ? (
                <Text style={styles.muted}>
                  No hay {rankingType === "egreso" ? "egresos" : "ingresos"} en este período.
                </Text>
              ) : (
                <View>
                  {rankingItems.map((it, index) => (
                    <View key={it.label} style={[styles.rankRow, index > 0 && styles.rankRowDivider]}>
                      <View style={styles.rankChip}>
                        <Text style={styles.rankChipText}>{`N° ${index + 1}`}</Text>
                      </View>
                      <Text style={styles.rankName} numberOfLines={1}>
                        {it.label}
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
          </View>
        </ScrollView>
      )}

      {/* Selector de mes (o de año en la vista "Año") */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.pickerCard} onPress={() => {}}>
            <View style={styles.pickerHead}>
              <TouchableOpacity style={styles.calArrow} onPress={() => setPickerYear((y) => y - 1)}>
                <Ionicons name="chevron-back" size={17} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.pickerYear}>{pickerYear}</Text>
              <TouchableOpacity
                style={[styles.calArrow, pickerYear >= hoyAnio && { opacity: 0.3 }]}
                onPress={() => setPickerYear((y) => y + 1)}
                disabled={pickerYear >= hoyAnio}
              >
                <Ionicons name="chevron-forward" size={17} color={colors.text} />
              </TouchableOpacity>
            </View>

            {period === "year" ? (
              <TouchableOpacity
                style={styles.pickerYearBtn}
                onPress={() => {
                  setYear(pickerYear);
                  setPickerOpen(false);
                }}
              >
                <Text style={styles.pickerYearBtnText}>Ver {pickerYear}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.pickerGrid}>
                {MESES_CORTOS.map((nombre, i) => {
                  const futuro = pickerYear > hoyAnio || (pickerYear === hoyAnio && i > hoyMes);
                  const activo =
                    monthDate.getFullYear() === pickerYear && monthDate.getMonth() === i;
                  return (
                    <TouchableOpacity
                      key={nombre}
                      style={[
                        styles.pickerMonth,
                        activo && styles.pickerMonthOn,
                        futuro && { opacity: 0.3 },
                      ]}
                      disabled={futuro}
                      onPress={() => {
                        setMonthDate(new Date(pickerYear, i, 1));
                        setPickerOpen(false);
                      }}
                    >
                      <Text style={[styles.pickerMonthText, activo && styles.pickerMonthTextOn]}>
                        {nombre}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={styles.pickerToday}
              onPress={() => {
                setMonthDate(new Date(hoyAnio, hoyMes, 1));
                setYear(hoyAnio);
                setPickerOpen(false);
              }}
            >
              <Text style={styles.pickerTodayText}>
                {period === "year" ? "Ir a este año" : "Ir a este mes"}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
      gap: 10,
      backgroundColor: colors.bg,
    },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    title: { color: colors.text, fontSize: 17, fontWeight: "700" },
    content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 30 },
    error: { color: colors.red, marginBottom: 10 },

    currencySwitch: {
      flexDirection: "row",
      gap: 3,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 11,
      padding: 3,
    },
    curBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 8 },
    curBtnActive: { backgroundColor: colors.segActive },
    curText: { color: colors.muted, fontWeight: "800", fontSize: 12.5 },
    curTextActive: { color: colors.segActiveText },

    periodChips: { flexDirection: "row", gap: 7 },
    periodChip: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    periodChipActive: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
    periodChipText: { color: colors.muted, fontWeight: "700", fontSize: 12.5 },
    periodChipTextActive: { color: colors.greenDark },

    // Calendario (‹ fecha ›)
    calRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    calArrow: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    calLabelBtn: {
      flex: 1,
      height: 34,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    calLabel: { color: colors.text, fontSize: 13.5, fontWeight: "800", textTransform: "capitalize" },

    // Panel único: mismo fondo que la pantalla + borde; adentro, líneas
    panel: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 20,
      overflow: "hidden",
    },
    block: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    blockHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 },
    kicker: {
      color: colors.greenBright2,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    blockTitle: { color: colors.text, fontSize: 13.5, fontWeight: "600", marginTop: 2 },
    blockRight: { color: colors.text, fontSize: 13, fontWeight: "800" },

    // KPIs 2x2 separados por líneas
    summaryGrid: { flexDirection: "row", flexWrap: "wrap" },
    summaryCard: { width: "50%", paddingVertical: 14, paddingHorizontal: 14, gap: 5 },
    summaryCardLeft: { borderRightWidth: 1, borderRightColor: colors.cardBorder },
    summaryCardTop: { borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
    sumHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
    sumIcon: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    sumLabel: { color: colors.muted, fontSize: 12, fontWeight: "700", flexShrink: 1 },
    sumValue: { color: colors.text, fontSize: 19, fontWeight: "800" },
    sumSub: { color: colors.muted, fontSize: 11 },

    muted: { color: colors.muted, fontSize: 13 },

    // Barras (Composición)
    compLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    compLine: { flexDirection: "row", alignItems: "center", gap: 10 },
    compTrack: {
      flex: 1,
      height: 5,
      borderRadius: 999,
      backgroundColor: colors.cardBorder,
      overflow: "hidden",
    },
    compFill: { height: "100%", borderRadius: 999 },
    compPct: {
      color: colors.text,
      fontSize: 12.5,
      fontWeight: "800",
      minWidth: 50,
      textAlign: "right",
      fontVariant: ["tabular-nums"],
    },

    // Radar: leyenda color · categoría · % · monto
    radarLegend: { gap: 9, marginTop: 10 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
    legendDot: { width: 10, height: 10, borderRadius: 999 },
    legendLabel: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "600" },
    legendPct: {
      color: colors.muted,
      fontSize: 12.5,
      minWidth: 34,
      textAlign: "right",
      fontVariant: ["tabular-nums"],
    },
    legendValue: { color: colors.text, fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
    legendMutedText: { color: colors.muted, fontSize: 12 },

    // Evolución
    lineLegend: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 8 },

    // Ranking (filas planas con línea divisoria)
    rankSwitch: {
      flexDirection: "row",
      gap: 3,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 999,
      padding: 3,
    },
    rankSwitchBtn: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999 },
    rankSwitchOn: { backgroundColor: colors.segActive },
    rankSwitchText: { color: colors.muted, fontWeight: "800", fontSize: 11.5 },
    rankSwitchTextOn: { color: colors.segActiveText },
    rankRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
    rankRowDivider: { borderTopWidth: 1, borderTopColor: colors.cardBorder },
    rankChip: {
      minWidth: 40,
      height: 24,
      paddingHorizontal: 6,
      borderRadius: 7,
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.greenBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    rankChipText: { color: colors.text, fontSize: 11, fontWeight: "800" },
    rankName: { flex: 1, color: colors.text, fontSize: 13.5, fontWeight: "600" },
    rankAmt: { color: colors.text, fontSize: 13.5, fontWeight: "800", fontVariant: ["tabular-nums"] },
    rankPct: { color: colors.muted, fontSize: 11.5, fontWeight: "700" },

    // Selector de mes
    pickerOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "center",
      padding: 28,
    },
    pickerCard: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 20,
      padding: 16,
      gap: 14,
    },
    pickerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    pickerYear: { color: colors.text, fontSize: 17, fontWeight: "800" },
    pickerGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, justifyContent: "space-between" },
    pickerMonth: {
      width: "31.5%",
      alignItems: "center",
      paddingVertical: 11,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    pickerMonthOn: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
    pickerMonthText: { color: colors.text, fontSize: 13.5, fontWeight: "700", textTransform: "capitalize" },
    pickerMonthTextOn: { color: colors.greenDark },
    pickerYearBtn: {
      alignItems: "center",
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: colors.greenSoft,
      borderWidth: 1,
      borderColor: colors.greenBorder,
    },
    pickerYearBtnText: { color: colors.greenDark, fontSize: 14, fontWeight: "800" },
    pickerToday: { alignItems: "center", paddingVertical: 4 },
    pickerTodayText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  });
