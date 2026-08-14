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
import * as SecureStore from "expo-secure-store";
import { taskService } from "../api";
import { useTheme } from "../theme";
import { guardarTareasWidget } from "../services/tareasWidget";
import {
  filterTasksForDate,
  isTaskCompletedOnDate,
  getIsoDate,
  getPeriodRange,
  summarizePeriod,
} from "../utils/tasks";
import { loadNotifSettings } from "../utils/notifSettings";
import { syncTaskReminders } from "../utils/taskReminders";
import TaskFormModal, { TASK_COLORS } from "../components/TaskFormModal";
import TaskCalendar from "../components/TaskCalendar";
import TaskHistory from "../components/TaskHistory";
import ProgressRing from "../components/ProgressRing";
import CompartirTareaModal from "../components/CompartirTareaModal";

// Riel de horarios (como en la web): etiqueta de hora a la izquierda de cada
// tarea y orden por horario (exactas por minuto, luego Mañana/Tarde/Noche, y las
// "Sin hora" al final).
const isExactTime = (h) => /^\d{1,2}:\d{2}$/.test(String(h || "").trim());
const MOMENTO_RANK = { Mañana: 8 * 60, Tarde: 14 * 60, Noche: 20 * 60 };

const agendaKey = (t) => {
  const h = String(t.horario || "").trim();
  if (isExactTime(h)) {
    const [hh, mm] = h.split(":").map(Number);
    return hh * 60 + mm;
  }
  if (MOMENTO_RANK[h] != null) return MOMENTO_RANK[h];
  return 100000; // sin hora al final
};

const agendaLabel = (h) => {
  const s = String(h || "").trim();
  if (isExactTime(s)) return s;
  if (s === "Mañana" || s === "Tarde" || s === "Noche") return s;
  return "Sin hora";
};

// 30 frases de motivación: se muestra 1 por día (rota sola).
const FRASES_TAREAS = [
  "Las personas que cumplen sus tareas rinden más que las que las postergan. Hoy te toca a vos.",
  "Cada tarea que tachás es un ladrillo de la persona que querés ser.",
  "La disciplina es elegir lo que querés a largo plazo por sobre lo que querés ahora.",
  "No tenés que hacerlo perfecto, tenés que empezarlo.",
  "Una tarea hecha vale más que diez planeadas.",
  "El futuro se construye con lo que hacés hoy, no mañana.",
  "Los que hacen, avanzan. Los que esperan motivación, siguen igual.",
  "Hecho es mejor que perfecto. Dale para adelante.",
  "Pequeños pasos todos los días te llevan lejos.",
  "La constancia le gana al talento cuando el talento no es constante.",
  "Tu yo del futuro te va a agradecer lo que hagas ahora.",
  "Empezá aunque no tengas ganas: las ganas vienen después.",
  "Ordená tu día y tu cabeza se ordena sola.",
  "No cuentes los días, hacé que los días cuenten.",
  "El progreso, no la perfección, es lo que te mantiene en movimiento.",
  "Lo difícil de hoy es lo fácil de mañana si lo practicás.",
  "Menos excusas, más tareas tachadas.",
  "La motivación te arranca, el hábito te sostiene.",
  "Cada 'sí' a tu tarea es un 'no' a la mediocridad.",
  "Enfocate en una sola cosa y hacela bien.",
  "Los grandes resultados son la suma de pequeñas tareas cumplidas.",
  "Dejá de esperar el momento perfecto: crealo.",
  "Tu energía sigue a tu acción, no al revés.",
  "Cumplir con vos mismo es la mejor forma de subir tu autoestima.",
  "Hoy es un buen día para hacer eso que venís posponiendo.",
  "La suerte aparece cuando la preparación se encuentra con la acción.",
  "Terminar lo que empezás es un superpoder. Usalo.",
  "Un día productivo empieza con una sola tarea bien hecha.",
  "No busques hacer todo, buscá hacer lo importante.",
  "Sé constante en lo chico y lo grande llega solo.",
];

const diaDelAnio = (date) => {
  const inicio = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - inicio) / 86400000);
};

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
  const [openMenu, setOpenMenu] = useState(null);
  const [tipWidget, setTipWidget] = useState(false); // aviso "agregá el widget"
  const [compartirTask, setCompartirTask] = useState(null); // tarea a compartir
  const [invitaciones, setInvitaciones] = useState([]); // invitaciones pendientes

  // Mostrar el aviso del widget una sola vez (hasta que lo cierren).
  useEffect(() => {
    SecureStore.getItemAsync("tip_widget_tareas")
      .then((v) => setTipWidget(v !== "1"))
      .catch(() => {});
  }, []);
  const cerrarTipWidget = () => {
    setTipWidget(false);
    SecureStore.setItemAsync("tip_widget_tareas", "1").catch(() => {});
  };

  const fetchTasks = useCallback(async () => {
    setError("");
    try {
      const res = await taskService.getAll({ tipo: "task" });
      const list = Array.isArray(res.data) ? res.data : [];
      setAllTasks(list);
      // Invitaciones a tareas compartidas (para el banner de arriba).
      taskService
        .invitaciones()
        .then(({ data }) => setInvitaciones(data?.invitaciones || []))
        .catch(() => {});
      // Espeja las tareas pendientes de hoy al widget de iOS (App Group),
      // ordenadas por horario y con la hora que muestra el widget.
      const hoy = new Date();
      const pendientesHoy = filterTasksForDate(list, hoy)
        .filter((t) => !isTaskCompletedOnDate(t, hoy))
        .sort((a, b) => agendaKey(a) - agendaKey(b))
        .map((t) => {
          const lbl = agendaLabel(t.horario);
          const color =
            TASK_COLORS[t.color] ||
            (typeof t.color === "string" && t.color.startsWith("#") ? t.color : TASK_COLORS.color1);
          return { titulo: t.meta || "", hora: lbl === "Sin hora" ? "" : lbl, color };
        });
      guardarTareasWidget(pendientesHoy);
      // Reprogramamos los recordatorios "X min antes" con las tareas frescas.
      loadNotifSettings()
        .then((s) => syncTaskReminders(list, s))
        .catch(() => {});
    } catch (err) {
      setError("No se pudieron cargar las tareas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const aceptarInvitacion = async (inv) => {
    setInvitaciones((prev) => prev.filter((x) => x.id !== inv.id));
    try {
      const { data } = await taskService.aceptarInvitacion(inv.id);
      // La mostramos al toque con lo que devuelve el backend...
      if (data?.tarea) {
        setAllTasks((prev) => [
          ...prev.filter((t) => String(t._id) !== String(data.tarea._id)),
          data.tarea,
        ]);
      }
    } catch {
      /* no-op */
    }
    fetchTasks(); // ...y reconciliamos con el servidor.
  };
  const rechazarInvitacion = async (inv) => {
    setInvitaciones((prev) => prev.filter((x) => x.id !== inv.id));
    try {
      await taskService.salir(inv.id);
    } catch {
      /* no-op */
    }
  };

  const dayTasks = useMemo(
    () => filterTasksForDate(allTasks, selectedDate),
    [allTasks, selectedDate]
  );
  const completedCount = dayTasks.filter((t) => isTaskCompletedOnDate(t, selectedDate)).length;
  const pendingCount = Math.max(dayTasks.length - completedCount, 0);
  const progressPercent = dayTasks.length ? Math.round((completedCount / dayTasks.length) * 100) : 0;

  // Progreso del mes vs. el mes pasado + frase del día.
  const comparativaMes = useMemo(() => {
    const hoy = new Date();
    const act = getPeriodRange("month", hoy);
    const ant = getPeriodRange(
      "month",
      new Date(hoy.getFullYear(), hoy.getMonth() - 1, 15)
    );
    const a = summarizePeriod(allTasks, act.from, act.to);
    const b = summarizePeriod(allTasks, ant.from, ant.to);
    return {
      actual: a.percent,
      anterior: b.percent,
      diff: a.percent - b.percent,
      total: a.total,
      totalAnt: b.total,
    };
  }, [allTasks]);
  const fraseDelDia = FRASES_TAREAS[diaDelAnio(new Date()) % FRASES_TAREAS.length];

  // Tareas ordenadas por horario para el riel de la izquierda.
  const sortedTasks = useMemo(
    () => [...dayTasks].sort((a, b) => agendaKey(a) - agendaKey(b)),
    [dayTasks]
  );

  const toggleComplete = async (task) => {
    const id = task._id;
    const iso = getIsoDate(selectedDate);
    const wasDone = isTaskCompletedOnDate(task, selectedDate);

    // Optimista: marcamos/desmarcamos al toque, sin esperar la red ni refetch.
    const applyLocal = (done) =>
      setAllTasks((prev) =>
        prev.map((t) => {
          if (t._id !== id) return t;
          const set = new Set(t.completadasEn || []);
          if (done) set.add(iso);
          else set.delete(iso);
          return { ...t, completadasEn: Array.from(set) };
        })
      );

    applyLocal(!wasDone);

    try {
      const res = await taskService.updateStatus(id, { fecha: iso });
      // Reconciliamos con el server si nos manda el estado real.
      if (res?.data && Array.isArray(res.data.completadasEn)) {
        setAllTasks((prev) =>
          prev.map((t) => (t._id === id ? { ...t, completadasEn: res.data.completadasEn } : t))
        );
      }
    } catch {
      applyLocal(wasDone); // revertimos
      Alert.alert("Error", "No se pudo actualizar la tarea.");
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

  const handleSalir = (task) => {
    Alert.alert("Salir de la tarea", `¿Dejar de colaborar en "${task.meta}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: async () => {
          try {
            await taskService.salir(task._id);
            await fetchTasks();
          } catch {
            Alert.alert("Error", "No se pudo salir de la tarea.");
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
          {/* Frase del día, arriba de todo (entre el switch y el header del día) */}
          <View style={styles.fraseWrap}>
            <View style={styles.fraseCard}>
              <Text style={styles.fraseTexto}>
                <Text style={styles.fraseLabel}>Frase del día: </Text>
                {fraseDelDia}
              </Text>
            </View>
          </View>

          {/* Día seleccionado (se cambia desde el Calendario) */}
          <View style={styles.dayHeader}>
            <Ionicons name="calendar-outline" size={16} color={colors.greenDark} />
            <Text style={styles.dayHeaderText}>{dateLabel}</Text>
          </View>

          <FlatList
            data={sortedTasks}
            keyExtractor={(item) => item._id}
            contentContainerStyle={{ padding: 16, paddingTop: 2, gap: 10, paddingBottom: 90 }}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={fetchTasks} tintColor={colors.green} />
            }
            ListHeaderComponent={
              <View>
                {tipWidget ? (
                  <View style={styles.tipCard}>
                    <Ionicons name="phone-portrait-outline" size={20} color={colors.greenBright} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tipTitulo}>Sumá el widget de Tareas 📱</Text>
                      <Text style={styles.tipTexto}>
                        Mirá tus tareas de hoy desde la pantalla de inicio: mantené apretada la home →
                        botón + → buscá “Growth”.
                      </Text>
                    </View>
                    <TouchableOpacity onPress={cerrarTipWidget} hitSlop={8}>
                      <Ionicons name="close" size={18} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {invitaciones.map((inv) => (
                  <View key={inv.id} style={styles.invCard}>
                    <Ionicons name="people" size={20} color={colors.greenBright} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.invTitulo} numberOfLines={2}>
                        {inv.de?.fullName || inv.de?.username || "Alguien"} te invitó a la tarea “{inv.meta}”
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.invAceptar} onPress={() => aceptarInvitacion(inv)} hitSlop={6}>
                      <Text style={styles.invAceptarTxt}>Aceptar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => rechazarInvitacion(inv)} hitSlop={8}>
                      <Ionicons name="close" size={20} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={styles.progressCard}>
                  <ProgressRing percent={progressPercent} />
                  <View style={styles.progressSide}>
                    <Text style={styles.progressKicker}>Progreso</Text>
                    <View style={styles.progressStats}>
                      <Text style={styles.statLine}>
                        <Text style={styles.statCompletadas}>{completedCount}</Text> tareas completadas
                      </Text>
                      <Text style={styles.statLine}>
                        <Text style={styles.statPendientes}>{pendingCount}</Text> tareas pendientes
                      </Text>
                    </View>
                  </View>
                </View>

                {comparativaMes.total > 0 || comparativaMes.totalAnt > 0 ? (
                  <Text style={styles.comparativa}>
                    Este mes cumpliste el {comparativaMes.actual}% de tus tareas ·
                    el mes pasado fue {comparativaMes.anterior}%
                  </Text>
                ) : null}
              </View>
            }
            ListEmptyComponent={<Text style={styles.empty}>No hay tareas para este día.</Text>}
            renderItem={({ item }) => {
              const done = isTaskCompletedOnDate(item, selectedDate);
              const accent =
                TASK_COLORS[item.color] ||
                (item.color?.startsWith?.("#") ? item.color : TASK_COLORS.color1);
              const menuOpen = openMenu === item._id;
              const fg = done ? colors.muted : "#16241d";
              return (
                <View style={styles.agendaRow}>
                  {/* Riel de horario a la izquierda (compacto, como en la web) */}
                  <View style={styles.agendaTime}>
                    <View style={styles.agendaLine} />
                    <Text style={styles.agendaTimeLabel} numberOfLines={1}>
                      {agendaLabel(item.horario)}
                    </Text>
                    <View style={styles.agendaDot} />
                  </View>
                  <View style={[styles.card, styles.cardFlex, { backgroundColor: done ? colors.cardSoft : accent }]}>
                  <View style={styles.cardTop}>
                    {/* Izquierda: opciones (tres puntitos) */}
                    <TouchableOpacity
                      style={[styles.optionsBtn, { backgroundColor: done ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)" }]}
                      onPress={() => setOpenMenu(menuOpen ? null : item._id)}
                      hitSlop={6}
                    >
                      <Ionicons name="ellipsis-vertical" size={18} color={fg} />
                    </TouchableOpacity>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, done && styles.cardTitleDone]}>{item.meta}</Text>
                      <View style={styles.metaRow}>
                        {item.urgencia ? <Text style={styles.metaChip}>{item.urgencia}</Text> : null}
                        {item.compartida ? (
                          <View style={styles.compartidaChip}>
                            <Ionicons name="people" size={11} color="#16241d" />
                            <Text style={styles.compartidaChipTxt}>
                              {item.soyOwner === false ? "Compartida conmigo" : "Compartida"}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Derecha: check circular (verde lleno al completar) */}
                    <TouchableOpacity
                      style={[
                        styles.checkCircle,
                        { borderColor: done ? colors.greenBright : "rgba(0,0,0,0.35)" },
                        done && styles.checkCircleDone,
                      ]}
                      onPress={() => toggleComplete(item)}
                      disabled={busyIds.includes(item._id)}
                    />
                  </View>

                  {/* Fila desplegable: editar (ícono) / compartir / eliminar (ícono) */}
                  {menuOpen ? (
                    <View style={styles.cardExpanded}>
                      <TouchableOpacity
                        style={styles.expandedIconBtn}
                        onPress={() => {
                          setOpenMenu(null);
                          setEditTask(item);
                          setShowForm(true);
                        }}
                        accessibilityLabel="Editar tarea"
                      >
                        <Ionicons name="pencil" size={18} color={fg} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.expandedIconBtn, { flexDirection: "row" }]}
                        onPress={() => {
                          setOpenMenu(null);
                          setCompartirTask(item);
                        }}
                        accessibilityLabel="Compartir tarea"
                      >
                        <Ionicons name="people-outline" size={18} color={fg} />
                        <Ionicons name="add" size={14} color={fg} style={{ marginLeft: -1, marginTop: -6 }} />
                      </TouchableOpacity>
                      {item.soyOwner === false ? (
                        <TouchableOpacity
                          style={[styles.expandedIconBtn, styles.expandedDelete]}
                          onPress={() => {
                            setOpenMenu(null);
                            handleSalir(item);
                          }}
                          accessibilityLabel="Salir de la tarea"
                        >
                          <Ionicons name="exit-outline" size={18} color={fg} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.expandedIconBtn, styles.expandedDelete]}
                          onPress={() => {
                            setOpenMenu(null);
                            handleDelete(item);
                          }}
                          accessibilityLabel="Eliminar tarea"
                        >
                          <Ionicons name="trash-outline" size={18} color={fg} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : null}
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

      {compartirTask ? (
        <CompartirTareaModal
          task={compartirTask}
          onClose={() => setCompartirTask(null)}
          onCambio={fetchTasks}
        />
      ) : null}
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
    paddingTop: 2,
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
  // Riel de horario a la izquierda de cada tarea (compacto, como en la web).
  agendaRow: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  agendaTime: {
    width: 42,
    paddingRight: 8,
    paddingTop: 12,
    alignItems: "flex-end",
    position: "relative",
  },
  agendaLine: {
    position: "absolute",
    top: 0,
    bottom: -10,
    right: 0,
    width: 2,
    backgroundColor: colors.cardBorder,
  },
  agendaTimeLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.text,
    textAlign: "right",
  },
  agendaDot: {
    position: "absolute",
    top: 15,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.greenBright,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  cardFlex: { flex: 1 },

  tipCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(93,199,45,0.30)",
    backgroundColor: "rgba(93,199,45,0.08)",
    marginBottom: 12,
  },
  tipTitulo: { color: colors.text, fontSize: 14, fontWeight: "800" },
  tipTexto: { color: colors.muted, fontSize: 12.5, lineHeight: 18, fontWeight: "600", marginTop: 2 },

  // Banner de invitación a tarea compartida.
  invCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(93,199,45,0.35)",
    backgroundColor: "rgba(93,199,45,0.10)",
    marginBottom: 10,
  },
  invTitulo: { color: colors.text, fontSize: 13.5, fontWeight: "700", lineHeight: 19 },
  invAceptar: {
    backgroundColor: colors.greenBright,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  invAceptarTxt: { color: "#06210a", fontSize: 13, fontWeight: "800" },

  progressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 6,
    paddingBottom: 12,
  },
  // Comparativa de progreso + frase del día
  comparativa: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginBottom: 10,
  },
  fraseWrap: { paddingHorizontal: 16, paddingTop: 12 },
  fraseCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(93,199,45,0.28)",
    backgroundColor: "rgba(93,199,45,0.09)",
    marginBottom: 12,
  },
  fraseLabel: {
    color: colors.greenBright,
    fontWeight: "800",
  },
  fraseTexto: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  progressStats: { gap: 4, marginTop: 2 },
  statLine: { color: colors.muted, fontSize: 13 },
  statCompletadas: { color: "#75F94C", fontSize: 15, fontWeight: "800" },
  statPendientes: { color: "#EB3223", fontSize: 15, fontWeight: "800" },
  progressSide: { flex: 1, gap: 8 },
  progressKicker: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  card: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  optionsBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2.5,
    backgroundColor: "transparent",
  },
  checkCircleDone: { backgroundColor: colors.greenBright },
  cardExpanded: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.18)",
  },
  expandedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    // Chip claro y opaco: garantiza contraste del texto sobre cualquier
    // color de tarjeta (pastel, gris o la oscura) y en tarjeta completada.
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  expandedIconBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  expandedDelete: {},
  expandedText: { fontWeight: "800", fontSize: 13 },
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
  compartidaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.10)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  compartidaChipTxt: { color: "#16241d", fontSize: 11.5, fontWeight: "800" },
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
