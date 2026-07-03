import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { taskService } from "../api";
import { useTheme } from "../theme";
import { filterTasksForDate, isTaskCompletedOnDate, getIsoDate } from "../utils/tasks";
import TaskFormModal, { TASK_COLORS } from "../components/TaskFormModal";
import TaskCalendar from "../components/TaskCalendar";
import TaskHistory from "../components/TaskHistory";
import ProgressRing from "../components/ProgressRing";

export default function TareasScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [busyIds, setBusyIds] = useState([]);
  const [viewMode, setViewMode] = useState("day"); // day | calendar | history
  const [formDate, setFormDate] = useState(null);
  const [editTask, setEditTask] = useState(null);

  const fetchTasks = useCallback(async () => {
    setError("");
    try {
      const res = await taskService.getAll({ tipo: "task", workspace: "personal" });
      setAllTasks(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError("No se pudieron cargar las tareas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const dayTasks = useMemo(
    () => filterTasksForDate(allTasks, selectedDate),
    [allTasks, selectedDate]
  );
  const completedCount = dayTasks.filter((t) => isTaskCompletedOnDate(t, selectedDate)).length;
  const pendingCount = Math.max(dayTasks.length - completedCount, 0);
  const progressPercent = dayTasks.length ? Math.round((completedCount / dayTasks.length) * 100) : 0;

  const toggleComplete = async (task) => {
    const id = task._id;
    setBusyIds((p) => [...p, id]);
    try {
      await taskService.updateStatus(id, { fecha: getIsoDate(selectedDate) });
      await fetchTasks();
    } catch {
      Alert.alert("Error", "No se pudo actualizar la tarea.");
    } finally {
      setBusyIds((p) => p.filter((x) => x !== id));
    }
  };

  const handleDelete = (task) => {
    Alert.alert("Eliminar tarea", `¿Borrar "${task.meta}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await taskService.delete(task._id);
            await fetchTasks();
          } catch {
            Alert.alert("Error", "No se pudo eliminar.");
          }
        },
      },
    ]);
  };

  const dateLabel = selectedDate.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const handleDayPress = (date) => {
    Alert.alert(
      date.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" }),
      "¿Qué querés hacer?",
      [
        { text: "Ver tareas del día", onPress: () => { setSelectedDate(date); setViewMode("day"); } },
        { text: "Crear tarea", onPress: () => { setEditTask(null); setFormDate(date); setShowForm(true); } },
        { text: "Cancelar", style: "cancel" },
      ]
    );
  };

  const openNewTask = () => {
    setEditTask(null);
    setFormDate(selectedDate);
    setShowForm(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {/* Switcher de vistas */}
      <View style={styles.switchRow}>
        {[
          ["day", "Día"],
          ["calendar", "Calendario"],
          ["history", "Historial"],
        ].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.switchBtn, viewMode === key && styles.switchActive]}
            onPress={() => setViewMode(key)}
          >
            <Text style={[styles.switchText, viewMode === key && styles.switchTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 30 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : viewMode === "calendar" ? (
        <TaskCalendar tasks={allTasks} onDayPress={handleDayPress} />
      ) : viewMode === "history" ? (
        <TaskHistory tasks={allTasks} />
      ) : (
        <>
          {/* Día seleccionado (se cambia desde el Calendario) */}
          <View style={styles.dayHeader}>
            <Ionicons name="calendar-outline" size={16} color={colors.greenDark} />
            <Text style={styles.dayHeaderText}>{dateLabel}</Text>
          </View>

          <FlatList
            data={dayTasks}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ padding: 16, paddingTop: 12, gap: 10, paddingBottom: 90 }}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={fetchTasks} tintColor={colors.green} />
            }
            ListHeaderComponent={
              <View style={styles.progressCard}>
                <ProgressRing percent={progressPercent} />
                <View style={styles.progressSide}>
                  <Text style={styles.progressKicker}>Progreso</Text>
                  <View style={styles.progressBoxes}>
                    <View style={styles.progressBox}>
                      <Text style={styles.progressNum}>{completedCount}</Text>
                      <Text style={styles.progressLbl}>completadas</Text>
                    </View>
                    <View style={styles.progressBox}>
                      <Text style={styles.progressNum}>{pendingCount}</Text>
                      <Text style={styles.progressLbl}>pendientes</Text>
                    </View>
                  </View>
                </View>
              </View>
            }
            ListEmptyComponent={<Text style={styles.empty}>No hay tareas para este día.</Text>}
            renderItem={({ item }) => {
              const done = isTaskCompletedOnDate(item, selectedDate);
              const accent = TASK_COLORS[item.color] || TASK_COLORS.color1;
              return (
                <View style={[styles.card, { backgroundColor: done ? colors.cardSoft : accent }]}>
                  <TouchableOpacity
                    style={[
                      styles.check,
                      { borderColor: "rgba(0,0,0,0.3)" },
                      done && { backgroundColor: colors.greenBright, borderColor: colors.greenBright },
                    ]}
                    onPress={() => toggleComplete(item)}
                    disabled={busyIds.includes(item._id)}
                  >
                    {done ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                  </TouchableOpacity>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, done && styles.cardTitleDone]}>{item.meta}</Text>
                    <View style={styles.metaRow}>
                      {item.urgencia ? <Text style={styles.metaChip}>{item.urgencia}</Text> : null}
                      {item.horario ? <Text style={styles.metaChip}>{item.horario}</Text> : null}
                    </View>
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      onPress={() => {
                        setEditTask(item);
                        setShowForm(true);
                      }}
                      hitSlop={8}
                    >
                      <Ionicons name="pencil" size={19} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={20} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        </>
      )}

      {/* FAB nueva tarea */}
      <TouchableOpacity style={styles.fab} onPress={openNewTask}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <TaskFormModal
        visible={showForm}
        defaultDate={formDate || selectedDate}
        editTask={editTask}
        onClose={() => {
          setShowForm(false);
          setEditTask(null);
        }}
        onSaved={fetchTasks}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  switchRow: {
    flexDirection: "row",
    gap: 6,
    margin: 16,
    marginBottom: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 5,
  },
  switchBtn: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 10 },
  switchActive: { backgroundColor: colors.segActive },
  switchText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  switchTextActive: { color: colors.segActiveText, fontWeight: "800" },
  dayNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dateText: { color: colors.text, fontWeight: "700", textTransform: "capitalize" },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 14,
  },
  dayHeaderText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 15,
    textTransform: "capitalize",
  },
  progress: {
    color: colors.muted,
    fontWeight: "700",
    fontSize: 13,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  error: { color: colors.red, padding: 16 },
  empty: { color: colors.muted, padding: 16, textAlign: "center" },

  progressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 6,
    paddingBottom: 16,
  },
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

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  cardTitleDone: { textDecorationLine: "line-through", color: colors.muted },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 5 },
  metaChip: {
    color: "#16241d",
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.10)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    textTransform: "capitalize",
    overflow: "hidden",
  },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.greenBright,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
