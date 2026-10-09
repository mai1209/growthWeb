import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { useTheme } from "../theme";
import ProgressRing from "./ProgressRing";
import {
  HISTORY_PERIODS,
  getPeriodRange,
  summarizePeriod,
  shiftPeriod,
  formatPeriodLabel,
  WEEKDAY_LABELS,
} from "../utils/tasks";

const mondayIndex = (d) => (d.getDay() + 6) % 7;

export default function TaskHistory({ tasks }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [period, setPeriod] = useState("month");
  const [ref, setRef] = useState(new Date());

  const range = useMemo(() => getPeriodRange(period, ref), [period, ref]);
  const summary = useMemo(() => summarizePeriod(tasks, range.from, range.to), [tasks, range]);

  const buckets = useMemo(() => {
    if (period === "year") {
      const months = Array.from({ length: 12 }, (_, m) => ({
        label: new Date(2000, m, 1).toLocaleDateString("es-AR", { month: "short" }),
        total: 0,
        done: 0,
      }));
      summary.perUnit.forEach((u) => {
        const m = u.day.getMonth();
        months[m].total += u.total;
        months[m].done += u.completed;
      });
      return months.map((b) => ({ ...b, percent: b.total ? Math.round((b.done / b.total) * 100) : 0 }));
    }
    return summary.perUnit.map((u) => ({
      label: period === "week" ? WEEKDAY_LABELS[mondayIndex(u.day)] : String(u.day.getDate()),
      total: u.total,
      done: u.completed,
      percent: u.total ? Math.round((u.completed / u.total) * 100) : 0,
    }));
  }, [summary, period]);

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {/* Progreso del período (anillo) */}
      <View style={styles.progressCard}>
        <ProgressRing percent={summary.percent} />
        <View style={styles.progressSide}>
          <Text style={styles.progressKicker}>Progreso</Text>
          <View style={styles.progressBoxes}>
            <View style={styles.progressBox}>
              <Text style={styles.progressNum}>{summary.done}</Text>
              <Text style={styles.progressLbl}>hechas</Text>
            </View>
            <View style={styles.progressBox}>
              <Text style={styles.progressNum}>{summary.pending}</Text>
              <Text style={styles.progressLbl}>pendientes</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Filtro de período */}
      <View style={styles.periods}>
        {HISTORY_PERIODS.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[styles.periodBtn, period === p.value && styles.periodActive]}
            onPress={() => setPeriod(p.value)}
          >
            <Text style={[styles.periodText, period === p.value && styles.periodTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Nav de período */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => setRef((d) => shiftPeriod(period, d, -1))} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navLabel}>{formatPeriodLabel(period, ref)}</Text>
        <TouchableOpacity onPress={() => setRef((d) => shiftPeriod(period, d, 1))} hitSlop={10}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Rendimiento */}
      <View style={styles.statsRow}>
        {[
          { v: `${summary.percent}%`, l: "rendimiento" },
          { v: String(summary.total), l: "tareas" },
          { v: String(summary.done), l: "hechas" },
          { v: String(summary.pending), l: "pendientes" },
        ].map((s) => (
          <View key={s.l} style={styles.statBox}>
            <Text style={styles.statValue}>{s.v}</Text>
            <Text style={styles.statLabel}>{s.l}</Text>
          </View>
        ))}
      </View>

      {/* Gráfico de barras */}
      {summary.total === 0 ? (
        <Text style={styles.empty}>No hay tareas en este período.</Text>
      ) : (
        <>
          {/* Barras finas con % arriba y eje 0–100, como en la web */}
          <View style={styles.chart}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(() => {
                const LEFT = 32;
                const COL = buckets.length > 12 ? 30 : buckets.length > 7 ? 36 : 44;
                const BODY = 8;
                const TOP = 18;
                const H = 170;
                const BOTTOM = 22;
                const PLOT = H - TOP - BOTTOM;
                const W = Math.max(LEFT + buckets.length * COL + 8, 300);
                const yVal = (pct) => TOP + PLOT * (1 - pct / 100);
                return (
                  <Svg width={W} height={H}>
                    {[0, 25, 50, 75, 100].map((pct) => (
                      <React.Fragment key={pct}>
                        <Line x1={LEFT} x2={W} y1={yVal(pct)} y2={yVal(pct)} stroke={colors.cardBorder} strokeWidth={1} />
                        <SvgText x={LEFT - 5} y={yVal(pct) + 3} textAnchor="end" fontSize="9" fontWeight="700" fill={colors.muted}>
                          {`${pct}%`}
                        </SvgText>
                      </React.Fragment>
                    ))}
                    {buckets.map((b, i) => {
                      const cx = LEFT + i * COL + COL / 2;
                      const h = Math.max(b.total ? 3 : 0, yVal(0) - yVal(b.percent));
                      return (
                        <React.Fragment key={i}>
                          <Rect
                            x={cx - BODY / 2}
                            y={yVal(0) - h}
                            width={BODY}
                            height={h}
                            rx={3}
                            fill="#75f94c"
                            opacity={b.total ? 1 : 0.25}
                          />
                          {b.total ? (
                            <SvgText x={cx} y={Math.max(yVal(0) - h - 5, 9)} textAnchor="middle" fontSize="9" fontWeight="800" fill="#75f94c">
                              {`${b.percent}%`}
                            </SvgText>
                          ) : null}
                          <SvgText x={cx} y={H - 6} textAnchor="middle" fontSize="9" fontWeight="700" fill={colors.muted}>
                            {String(b.label)}
                          </SvgText>
                        </React.Fragment>
                      );
                    })}
                  </Svg>
                );
              })()}
            </ScrollView>
          </View>

          <Text style={styles.legend}>
            Cada barra muestra el % de tareas completadas
            {period === "year"
              ? " en cada mes"
              : period === "week"
              ? " en cada día de la semana"
              : period === "month"
              ? " en cada día del mes"
              : " del día"}
            . Arriba ves el total: tareas, hechas y pendientes.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  body: { padding: 16, gap: 14, paddingBottom: 100 },
  progressCard: { flexDirection: "row", alignItems: "center", gap: 16 },
  progressSide: { flex: 1, gap: 8 },
  progressKicker: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  progressBoxes: { flexDirection: "row", gap: 8 },
  progressBox: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  progressNum: { color: colors.text, fontSize: 20, fontWeight: "800" },
  progressLbl: { color: colors.muted, fontSize: 11, marginTop: 2 },
  periods: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 9,
    padding: 3,
  },
  periodBtn: { flex: 1, alignItems: "center", paddingVertical: 6, borderRadius: 7 },
  periodActive: { backgroundColor: "#75f94c" },
  periodText: { color: colors.muted, fontWeight: "700", fontSize: 12.5 },
  periodTextActive: { color: "#06210a", fontWeight: "800" },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navLabel: { color: colors.text, fontWeight: "800", fontSize: 15, textTransform: "capitalize" },
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: "800" },
  statLabel: { color: colors.muted, fontSize: 10, marginTop: 2 },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: 30 },
  legend: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  chart: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  bar: { flex: 1, alignItems: "center", gap: 5, height: "100%" },
  barTrack: {
    flex: 1,
    width: "100%",
    maxWidth: 26,
    justifyContent: "flex-end",
    backgroundColor: "#d7e0d6",
    borderRadius: 6,
    overflow: "hidden",
  },
  barFill: { width: "100%", backgroundColor: colors.greenBright, borderRadius: 6 },
  barLabel: { color: colors.muted, fontSize: 9 },
});
