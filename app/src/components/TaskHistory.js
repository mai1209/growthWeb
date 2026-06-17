import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
        <View style={styles.chart}>
          {buckets.map((b, i) => (
            <View key={i} style={styles.bar}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: `${Math.max(b.percent, 2)}%` }]} />
              </View>
              <Text style={styles.barLabel} numberOfLines={1}>
                {b.label}
              </Text>
            </View>
          ))}
        </View>
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  progressNum: { color: colors.text, fontSize: 20, fontWeight: "800" },
  progressLbl: { color: colors.muted, fontSize: 11, marginTop: 2 },
  periods: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 5,
  },
  periodBtn: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 10 },
  periodActive: { backgroundColor: colors.greenDark },
  periodText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  periodTextActive: { color: "#fff" },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navLabel: { color: colors.text, fontWeight: "800", fontSize: 15, textTransform: "capitalize" },
  statsRow: { flexDirection: "row", gap: 8 },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: "800" },
  statLabel: { color: colors.muted, fontSize: 10, marginTop: 2 },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: 30 },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 180,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 10,
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
