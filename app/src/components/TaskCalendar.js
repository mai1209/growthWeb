import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import {
  buildMonthGrid,
  filterTasksForDate,
  isTaskCompletedOnDate,
  isSameDay,
  shiftPeriod,
  WEEKDAY_LABELS,
} from "../utils/tasks";
import { TASK_COLORS } from "./TaskFormModal";

export default function TaskCalendar({ tasks, onDayPress }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [ref, setRef] = useState(new Date());
  const cells = useMemo(() => buildMonthGrid(ref), [ref]);
  const today = new Date();

  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        <TouchableOpacity onPress={() => setRef((d) => shiftPeriod("month", d, -1))} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {ref.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
        </Text>
        <TouchableOpacity onPress={() => setRef((d) => shiftPeriod("month", d, 1))} hitSlop={10}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((d) => (
          <Text key={d} style={styles.weekLabel}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {Array.from({ length: 6 }).map((_, week) => (
          <View key={week} style={styles.weekGridRow}>
            {cells.slice(week * 7, week * 7 + 7).map(({ date, inMonth }, i) => {
              const dayTasks = filterTasksForDate(tasks, date);
              const isToday = isSameDay(date, today);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.cell, !inMonth && styles.cellMuted, isToday && styles.cellToday]}
                  onPress={() => onDayPress?.(date)}
                >
                  <Text style={styles.dayNum}>{date.getDate()}</Text>
                  <View style={styles.dots}>
                    {dayTasks.slice(0, 4).map((t) => {
                      const done = isTaskCompletedOnDate(t, date);
                      return (
                        <View
                          key={t._id}
                          style={[
                            styles.dot,
                            { backgroundColor: TASK_COLORS[t.color] || TASK_COLORS.color1 },
                            done && { opacity: 0.35 },
                          ]}
                        />
                      );
                    })}
                    {dayTasks.length > 4 ? (
                      <Text style={styles.more}>+{dayTasks.length - 4}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 8 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  monthLabel: { color: colors.text, fontSize: 16, fontWeight: "800", textTransform: "capitalize" },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekLabel: {
    flex: 1,
    textAlign: "center",
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  grid: { gap: 5 },
  weekGridRow: { flexDirection: "row", gap: 5 },
  cell: {
    flex: 1,
    aspectRatio: 1,
    padding: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  cellMuted: { opacity: 0.4 },
  cellToday: { borderColor: colors.greenBright, borderWidth: 2, backgroundColor: colors.greenSoft },
  dayNum: { color: colors.text, fontSize: 12, fontWeight: "700" },
  dots: { flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  more: { color: colors.muted, fontSize: 9, fontWeight: "700" },
});
