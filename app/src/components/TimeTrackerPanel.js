import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { timeEntryService, projectService } from "../api";

const RUNNING_KEY = "gm_timetracker_running";
const NO_PROJECT = "__none__";

const pad = (n) => String(n).padStart(2, "0");

const fmtDuration = (secs) => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(s % 60)}s`;
  return `${s % 60}s`;
};

const fmtClock = (secs) => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${pad(h)}:${pad(m)}:${pad(s % 60)}`;
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const startOfWeek = (d) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

const dayKeyOf = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

const buildMonthGrid = (ref) => {
  const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const start = startOfDay(first);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
};

const activeSecs = (r, nowMs) =>
  r
    ? r.accumulated + (r.segmentStart ? Math.floor((nowMs - new Date(r.segmentStart).getTime()) / 1000) : 0)
    : 0;

export default function TimeTrackerPanel({ colors }) {
  const styles = makeStyles(colors);

  const [projects, setProjects] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openProject, setOpenProject] = useState(undefined); // undefined = carpetas; obj|null
  const [newProjectName, setNewProjectName] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [running, setRunning] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishNotes, setFinishNotes] = useState("");
  const [expandedEntry, setExpandedEntry] = useState(null);
  const [entryNotesDraft, setEntryNotesDraft] = useState("");
  const [entryNotesOpen, setEntryNotesOpen] = useState(false);
  const [projectNotesDraft, setProjectNotesDraft] = useState("");
  const [projectNotesOpen, setProjectNotesOpen] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [pauseMotivo, setPauseMotivo] = useState("");
  const [topView, setTopView] = useState("proyectos"); // proyectos | calendario
  const [calRef, setCalRef] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayAddDate, setDayAddDate] = useState(null);
  const [dayForm, setDayForm] = useState({ proyecto: NO_PROJECT, nuevo: "", descripcion: "", horas: "", minutos: "" });
  const [dayAddSaving, setDayAddSaving] = useState(false);
  const tickRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([projectService.getAll(), timeEntryService.getAll()]);
      setProjects(Array.isArray(p.data) ? p.data : []);
      setEntries(Array.isArray(e.data) ? e.data : []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(RUNNING_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.firstStart) {
            setRunning(parsed);
            setDescripcion(parsed.descripcion || "");
          }
        }
      } catch {
        // nada
      }
    })();
  }, [fetchAll]);

  useEffect(() => {
    if (!running || !running.segmentStart) {
      if (tickRef.current) clearInterval(tickRef.current);
      return undefined;
    }
    setNow(Date.now());
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  const persistRunning = (r) => {
    setRunning(r);
    if (r) SecureStore.setItemAsync(RUNNING_KEY, JSON.stringify(r)).catch(() => {});
    else SecureStore.deleteItemAsync(RUNNING_KEY).catch(() => {});
  };

  const currentProjectId = openProject === null ? null : openProject?._id;

  const handleStart = () => {
    persistRunning({
      proyecto: currentProjectId ?? null,
      descripcion: descripcion.trim(),
      firstStart: new Date().toISOString(),
      accumulated: 0,
      segmentStart: new Date().toISOString(),
      pausas: [],
      pauseStart: null,
    });
  };
  const handlePause = () => {
    if (!running?.segmentStart) return;
    const acc =
      running.accumulated + Math.floor((Date.now() - new Date(running.segmentStart).getTime()) / 1000);
    persistRunning({ ...running, accumulated: acc, segmentStart: null, pauseStart: new Date().toISOString() });
  };
  const handleResume = () => {
    if (!running || running.segmentStart) return;
    const pausas = [...(running.pausas || [])];
    if (running.pauseStart) {
      pausas.push({ inicio: running.pauseStart, fin: new Date().toISOString(), motivo: pauseMotivo.trim() });
    }
    setPauseMotivo("");
    persistRunning({ ...running, segmentStart: new Date().toISOString(), pauseStart: null, pausas });
  };
  const confirmFinish = async () => {
    if (!running || saving) return;
    setSaving(true);
    const total = activeSecs(running, Date.now());
    const pausas = [...(running.pausas || [])];
    if (running.pauseStart) {
      pausas.push({ inicio: running.pauseStart, fin: new Date().toISOString(), motivo: pauseMotivo.trim() });
    }
    setPauseMotivo("");
    try {
      await timeEntryService.create({
        proyecto: running.proyecto || undefined,
        descripcion: running.descripcion || descripcion.trim(),
        notas: finishNotes,
        pausas,
        inicio: running.firstStart,
        fin: new Date().toISOString(),
        duracion: total,
      });
      persistRunning(null);
      setDescripcion("");
      setFinishNotes("");
      setFinishOpen(false);
      await fetchAll();
    } catch {
      Alert.alert("Error", "No se pudo guardar la sesión.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProject = async () => {
    const nombre = newProjectName.trim();
    if (!nombre) return;
    try {
      const res = await projectService.create({ nombre });
      setProjects((prev) => [res.data, ...prev]);
      setNewProjectName("");
    } catch {
      Alert.alert("Error", "No se pudo crear el proyecto.");
    }
  };

  const handleDeleteProject = (project, goBack = false) => {
    Alert.alert("Eliminar proyecto", `¿Borrar "${project.nombre}"? Las sesiones quedan como "Sin proyecto".`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await projectService.delete(project._id);
            setProjects((prev) => prev.filter((p) => p._id !== project._id));
            setEntries((prev) =>
              prev.map((e) => (e.proyecto === project._id ? { ...e, proyecto: null } : e))
            );
            if (goBack) setOpenProject(undefined);
          } catch {
            Alert.alert("Error", "No se pudo eliminar el proyecto.");
          }
        },
      },
    ]);
  };

  const handleDeleteOrphans = () => {
    const orphans = entries.filter((e) => !e.proyecto);
    if (!orphans.length) {
      Alert.alert("Sin sesiones", "No hay sesiones sin proyecto para borrar.");
      return;
    }
    Alert.alert("Borrar sesiones", `¿Borrar las ${orphans.length} sesiones sin proyecto? No se puede deshacer.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          try {
            await Promise.all(orphans.map((e) => timeEntryService.delete(e._id)));
            setEntries((prev) => prev.filter((e) => e.proyecto));
            setOpenProject(undefined);
          } catch {
            Alert.alert("Error", "No se pudieron borrar las sesiones.");
          }
        },
      },
    ]);
  };

  const handleDeleteEntry = (id) => {
    setMenuFor(null);
    Alert.alert("Eliminar", "¿Borrar esta sesión?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await timeEntryService.delete(id);
            setEntries((prev) => prev.filter((e) => e._id !== id));
          } catch {
            Alert.alert("Error", "No se pudo eliminar.");
          }
        },
      },
    ]);
  };

  const toggleExpand = (entry) => {
    if (expandedEntry === entry._id) {
      setExpandedEntry(null);
    } else {
      setExpandedEntry(entry._id);
      setEntryNotesDraft(entry.notas || "");
      setEntryNotesOpen(false);
    }
  };

  const handleSaveEntryNotes = async (id) => {
    try {
      await timeEntryService.update(id, { notas: entryNotesDraft });
      setEntries((prev) => prev.map((e) => (e._id === id ? { ...e, notas: entryNotesDraft } : e)));
      Alert.alert("Listo", "Notas guardadas.");
    } catch {
      Alert.alert("Error", "No se pudieron guardar las notas.");
    }
  };

  const handleSaveProjectNotes = async () => {
    if (!openProject?._id) return;
    try {
      await projectService.update(openProject._id, { notas: projectNotesDraft });
      setProjects((prev) =>
        prev.map((p) => (p._id === openProject._id ? { ...p, notas: projectNotesDraft } : p))
      );
      setOpenProject((prev) => (prev ? { ...prev, notas: projectNotesDraft } : prev));
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 1500);
    } catch {
      Alert.alert("Error", "No se pudieron guardar las notas del proyecto.");
    }
  };

  useEffect(() => {
    setProjectNotesDraft(openProject?.notas || "");
    setExpandedEntry(null);
  }, [openProject]);

  const totals = useMemo(() => {
    const map = new Map();
    const weekStart = startOfWeek(new Date());
    entries.forEach((e) => {
      const key = e.proyecto || NO_PROJECT;
      const cur = map.get(key) || { total: 0, week: 0, count: 0 };
      cur.total += Number(e.duracion) || 0;
      cur.count += 1;
      if (new Date(e.inicio) >= weekStart) cur.week += Number(e.duracion) || 0;
      map.set(key, cur);
    });
    return map;
  }, [entries]);

  const projMeta = useMemo(() => {
    const map = new Map();
    projects.forEach((p) => map.set(p._id, { nombre: p.nombre, color: p.color || "#5dc72d" }));
    map.set(NO_PROJECT, { nombre: "Sin proyecto", color: "#8a94a6" });
    return map;
  }, [projects]);

  const byDay = useMemo(() => {
    const map = new Map();
    entries.forEach((e) => {
      const key = dayKeyOf(e.inicio);
      const cur = map.get(key) || { total: 0, byProject: new Map() };
      const dur = Number(e.duracion) || 0;
      cur.total += dur;
      const pk = e.proyecto || NO_PROJECT;
      cur.byProject.set(pk, (cur.byProject.get(pk) || 0) + dur);
      map.set(key, cur);
    });
    return map;
  }, [entries]);

  const runningProject = running
    ? running.proyecto
      ? projects.find((p) => p._id === running.proyecto)
      : { nombre: "Sin proyecto" }
    : null;
  const elapsed = activeSecs(running, now);

  const goMonth = (delta) =>
    setCalRef((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  const openProjectById = (pid) => {
    if (pid === NO_PROJECT) return setOpenProject(null);
    const p = projects.find((x) => x._id === pid);
    if (p) setOpenProject(p);
  };

  const openDayAdd = (dateObj) => {
    setDayAddDate(dateObj);
    setDayForm({ proyecto: NO_PROJECT, nuevo: "", descripcion: "", horas: "", minutos: "" });
  };

  const submitDayEntry = async () => {
    if (!dayAddDate || dayAddSaving) return;
    const secs = (parseInt(dayForm.horas, 10) || 0) * 3600 + (parseInt(dayForm.minutos, 10) || 0) * 60;
    if (secs <= 0) {
      Alert.alert("Faltan datos", "Poné cuánto trabajaste (horas o minutos).");
      return;
    }
    setDayAddSaving(true);
    try {
      let proyectoId = dayForm.proyecto === NO_PROJECT ? undefined : dayForm.proyecto;
      if (dayForm.proyecto === "__new__") {
        const nombre = dayForm.nuevo.trim();
        if (!nombre) {
          Alert.alert("Faltan datos", "Poné el nombre del nuevo proyecto.");
          setDayAddSaving(false);
          return;
        }
        const res = await projectService.create({ nombre });
        setProjects((prev) => [res.data, ...prev]);
        proyectoId = res.data._id;
      }
      const inicio = new Date(dayAddDate.getFullYear(), dayAddDate.getMonth(), dayAddDate.getDate(), 9, 0, 0);
      const fin = new Date(inicio.getTime() + secs * 1000);
      await timeEntryService.create({
        proyecto: proyectoId,
        descripcion: dayForm.descripcion.trim(),
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        duracion: secs,
      });
      setSelectedDay(dayKeyOf(dayAddDate));
      setDayAddDate(null);
      await fetchAll();
    } catch {
      Alert.alert("Error", "No se pudo cargar el trabajo.");
    } finally {
      setDayAddSaving(false);
    }
  };

  // ---------- Vista Calendario (mobile) ----------
  const renderCalendar = () => {
    const cells = buildMonthGrid(calRef);
    const monthLabel = calRef.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    const todayKey = dayKeyOf(new Date());
    const dayData = selectedDay ? byDay.get(selectedDay) : null;

    return (
      <View style={styles.calWrap}>
        <View style={styles.calHead}>
          <TouchableOpacity onPress={() => goMonth(-1)} hitSlop={8} style={styles.calNavBtn}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.calMonth}>{monthLabel}</Text>
          <TouchableOpacity onPress={() => goMonth(1)} hitSlop={8} style={styles.calNavBtn}>
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.calRow}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={styles.calWeekday}>
              {w}
            </Text>
          ))}
        </View>

        <View style={styles.calGrid}>
          {cells.map((d) => {
            const key = dayKeyOf(d);
            const data = byDay.get(key);
            const inMonth = d.getMonth() === calRef.getMonth();
            const sel = selectedDay === key;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.calCell,
                  !inMonth && styles.calCellMuted,
                  data && styles.calCellHas,
                  key === todayKey && styles.calCellToday,
                  sel && styles.calCellSel,
                ]}
                onPress={() => setSelectedDay(key)}
                activeOpacity={0.7}
              >
                <Text style={styles.calDayNum}>{d.getDate()}</Text>
                {data ? <View style={styles.calDot} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedDay ? (
          <View style={styles.calDetail}>
            <View style={styles.calDetailHead}>
              <Text style={styles.calDetailDate}>
                {new Date(`${selectedDay}T00:00:00`).toLocaleDateString("es-AR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </Text>
              <Text style={styles.calDetailTotal}>{fmtDuration(dayData?.total || 0)}</Text>
            </View>
            {dayData ? (
              [...dayData.byProject.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([pk, secs]) => {
                  const meta = projMeta.get(pk) || { nombre: "Proyecto", color: "#5dc72d" };
                  return (
                    <TouchableOpacity key={pk} style={styles.calProjRow} onPress={() => openProjectById(pk)}>
                      <Ionicons name="folder-outline" size={16} color={meta.color} />
                      <Text style={styles.calProjName}>{meta.nombre}</Text>
                      <Text style={styles.calProjDur}>{fmtDuration(secs)}</Text>
                      <Ionicons name="play" size={14} color={colors.greenDark} />
                    </TouchableOpacity>
                  );
                })
            ) : (
              <Text style={styles.calHint}>Todavía no cargaste trabajo este día.</Text>
            )}
            <TouchableOpacity
              style={styles.calAddWork}
              onPress={() => openDayAdd(new Date(`${selectedDay}T00:00:00`))}
            >
              <Ionicons name="add" size={16} color={colors.greenDark} />
              <Text style={styles.calAddWorkText}>Cargar trabajo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.calHint}>Tocá un día para ver o cargar el trabajo.</Text>
        )}

        <Modal visible={Boolean(dayAddDate)} transparent animationType="fade" onRequestClose={() => setDayAddDate(null)}>
          <KeyboardAvoidingView
            style={styles.overlay}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setDayAddDate(null)} />
            <ScrollView
              style={{ width: "100%", flexGrow: 0 }}
              contentContainerStyle={{ justifyContent: "center" }}
              keyboardShouldPersistTaps="handled"
            >
            <TouchableOpacity activeOpacity={1} style={styles.sheet}>
              <Text style={styles.sheetTitle}>
                Cargar trabajo{dayAddDate ? ` · ${dayAddDate.toLocaleDateString("es-AR", { day: "numeric", month: "long" })}` : ""}
              </Text>

              <Text style={styles.fieldLabel}>Proyecto</Text>
              <View style={styles.projChips}>
                <TouchableOpacity
                  style={[styles.projChip, dayForm.proyecto === NO_PROJECT && styles.projChipActive]}
                  onPress={() => setDayForm((f) => ({ ...f, proyecto: NO_PROJECT }))}
                >
                  <Text style={[styles.projChipText, dayForm.proyecto === NO_PROJECT && styles.projChipTextActive]}>
                    Sin proyecto
                  </Text>
                </TouchableOpacity>
                {projects.map((p) => (
                  <TouchableOpacity
                    key={p._id}
                    style={[styles.projChip, dayForm.proyecto === p._id && styles.projChipActive]}
                    onPress={() => setDayForm((f) => ({ ...f, proyecto: p._id }))}
                  >
                    <Text style={[styles.projChipText, dayForm.proyecto === p._id && styles.projChipTextActive]}>
                      {p.nombre}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.projChip, dayForm.proyecto === "__new__" && styles.projChipActive]}
                  onPress={() => setDayForm((f) => ({ ...f, proyecto: "__new__" }))}
                >
                  <Text style={[styles.projChipText, dayForm.proyecto === "__new__" && styles.projChipTextActive]}>
                    ＋ Nuevo
                  </Text>
                </TouchableOpacity>
              </View>
              {dayForm.proyecto === "__new__" ? (
                <TextInput
                  style={styles.input}
                  value={dayForm.nuevo}
                  onChangeText={(t) => setDayForm((f) => ({ ...f, nuevo: t }))}
                  placeholder="Nombre del nuevo proyecto"
                  placeholderTextColor={colors.muted}
                />
              ) : null}

              <Text style={styles.fieldLabel}>¿Qué hiciste? (opcional)</Text>
              <TextInput
                style={styles.input}
                value={dayForm.descripcion}
                onChangeText={(t) => setDayForm((f) => ({ ...f, descripcion: t }))}
                placeholder="Ej: Diseño landing"
                placeholderTextColor={colors.muted}
              />

              <View style={styles.timeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Horas</Text>
                  <TextInput
                    style={styles.input}
                    value={dayForm.horas}
                    onChangeText={(t) => setDayForm((f) => ({ ...f, horas: t.replace(/[^\d]/g, "") }))}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Minutos</Text>
                  <TextInput
                    style={styles.input}
                    value={dayForm.minutos}
                    onChangeText={(t) => setDayForm((f) => ({ ...f, minutos: t.replace(/[^\d]/g, "") }))}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                  />
                </View>
              </View>

              <View style={styles.sheetActions}>
                <TouchableOpacity style={styles.ghostBtn} onPress={() => setDayAddDate(null)}>
                  <Text style={styles.ghostText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={submitDayEntry} disabled={dayAddSaving}>
                  {dayAddSaving ? (
                    <ActivityIndicator color="#0e1a0e" />
                  ) : (
                    <Text style={styles.saveText}>Guardar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  };

  // ---------- Vista carpetas ----------
  if (openProject === undefined) {
    const noneTotals = totals.get(NO_PROJECT);
    return (
      <View style={styles.wrap}>
        <View style={styles.topToggle}>
          <TouchableOpacity
            style={[styles.topToggleBtn, topView === "proyectos" && styles.topToggleActive]}
            onPress={() => setTopView("proyectos")}
          >
            <Text style={[styles.topToggleText, topView === "proyectos" && styles.topToggleTextActive]}>
              Proyectos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.topToggleBtn, topView === "calendario" && styles.topToggleActive]}
            onPress={() => setTopView("calendario")}
          >
            <Text style={[styles.topToggleText, topView === "calendario" && styles.topToggleTextActive]}>
              Calendario
            </Text>
          </TouchableOpacity>
        </View>

        {topView === "calendario" ? (
          renderCalendar()
        ) : (
        <>
        <View style={styles.createRow}>
          <TextInput
            style={styles.createInput}
            value={newProjectName}
            onChangeText={setNewProjectName}
            placeholder="Crear trabajo o proyecto…"
            placeholderTextColor={colors.muted}
            maxLength={80}
            onSubmitEditing={handleCreateProject}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.createBtn} onPress={handleCreateProject}>
            <Ionicons name="add" size={24} color="#0e1a0e" />
          </TouchableOpacity>
        </View>

        {running ? (
          <TouchableOpacity
            style={styles.runningBanner}
            onPress={() => setOpenProject(running.proyecto ? runningProject : null)}
          >
            <View style={styles.runningDot} />
            <Text style={styles.runningText}>
              Sesión {running.segmentStart ? "en curso" : "en pausa"} en{" "}
              <Text style={{ fontWeight: "800" }}>{runningProject?.nombre || "Sin proyecto"}</Text> ·{" "}
              {fmtClock(elapsed)}
            </Text>
          </TouchableOpacity>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.green} style={{ marginTop: 16 }} />
        ) : projects.length === 0 && !noneTotals ? (
          <Text style={styles.empty}>
            Todavía no tenés proyectos. Creá uno arriba para empezar a registrar tus horas.
          </Text>
        ) : (
          <>
            {projects.map((p) => {
              const t = totals.get(p._id) || { total: 0, week: 0, count: 0 };
              return (
                <TouchableOpacity key={p._id} style={styles.folderCard} onPress={() => setOpenProject(p)}>
                  <Ionicons name="folder-outline" size={22} color={p.color || colors.greenBright} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.folderName}>{p.nombre}</Text>
                    <Text style={styles.folderMeta}>
                      {t.count} {t.count === 1 ? "sesión" : "sesiones"} · semana {fmtDuration(t.week)}
                    </Text>
                  </View>
                  <Text style={styles.folderTotal}>{fmtDuration(t.total)}</Text>
                  <TouchableOpacity onPress={() => handleDeleteProject(p)} hitSlop={8} style={styles.folderTrash}>
                    <Ionicons name="trash-outline" size={18} color={colors.muted} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}

            {noneTotals ? (
              <TouchableOpacity style={styles.folderCard} onPress={() => setOpenProject(null)}>
                <Ionicons name="folder-outline" size={22} color={colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.folderName}>Sin proyecto</Text>
                  <Text style={styles.folderMeta}>
                    {noneTotals.count} {noneTotals.count === 1 ? "sesión" : "sesiones"}
                  </Text>
                </View>
                <Text style={styles.folderTotal}>{fmtDuration(noneTotals.total)}</Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
        </>
        )}
      </View>
    );
  }

  // ---------- Vista detalle ----------
  const projName = openProject === null ? "Sin proyecto" : openProject.nombre;
  const projEntries = entries
    .filter((e) => (e.proyecto || null) === currentProjectId)
    .sort((a, b) => new Date(b.inicio) - new Date(a.inicio));
  const projTotals = totals.get(currentProjectId || NO_PROJECT) || { total: 0, week: 0 };
  const isRunningHere = running && (running.proyecto || null) === currentProjectId;
  const runningElsewhere = running && !isRunningHere;

  return (
    <View style={styles.wrap}>
      {menuFor ? (
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, { zIndex: 5 }]}
          activeOpacity={1}
          onPress={() => setMenuFor(null)}
        />
      ) : null}
      <View style={styles.detailHead}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setOpenProject(undefined)}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.detailTitle} numberOfLines={1}>
            {projName}
          </Text>
          {openProject?.createdAt ? (
            <Text style={styles.detailDate}>
              Proyecto del{" "}
              {new Date(openProject.createdAt).toLocaleDateString("es-AR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.detailDelete}
          onPress={() => (openProject ? handleDeleteProject(openProject, true) : handleDeleteOrphans())}
        >
          <Ionicons name="trash-outline" size={19} color={colors.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.timerCard}>
        <TextInput
          style={styles.descInput}
          value={isRunningHere ? running.descripcion : descripcion}
          onChangeText={(t) =>
            isRunningHere ? persistRunning({ ...running, descripcion: t }) : setDescripcion(t)
          }
          placeholder="¿En qué estás trabajando?"
          placeholderTextColor={colors.muted}
          maxLength={160}
        />

        <Text style={styles.clock}>{fmtClock(isRunningHere ? elapsed : 0)}</Text>

        {runningElsewhere ? (
          <Text style={styles.warnNote}>
            Ya tenés una sesión en curso en {runningProject?.nombre}. Finalizala antes de arrancar otra.
          </Text>
        ) : !running ? (
          <TouchableOpacity style={[styles.bigBtn, styles.startBtn]} onPress={handleStart}>
            <Ionicons name="play" size={20} color="#0e1a0e" />
            <Text style={styles.startText}>Iniciar</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.timerBtns}>
            {running.segmentStart ? (
              <TouchableOpacity style={[styles.midBtn, styles.pauseBtn]} onPress={handlePause}>
                <Ionicons name="pause" size={18} color={colors.text} />
                <Text style={[styles.midText, { color: colors.text }]}>Pausa</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.midBtn, styles.resumeBtn]} onPress={handleResume}>
                <Ionicons name="play" size={18} color="#0e1a0e" />
                <Text style={[styles.midText, { color: "#0e1a0e" }]}>Reanudar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.midBtn, styles.stopBtn]}
              onPress={() => setFinishOpen(true)}
              disabled={saving}
            >
              <Ionicons name="stop" size={18} color="#fff" />
              <Text style={[styles.midText, { color: "#fff" }]}>Finalizar</Text>
            </TouchableOpacity>
          </View>
        )}

        {isRunningHere && !running.segmentStart ? (
          <TextInput
            style={styles.pauseInput}
            value={pauseMotivo}
            onChangeText={setPauseMotivo}
            placeholder="Motivo de la pausa (ej: comida)"
            placeholderTextColor={colors.muted}
            maxLength={120}
          />
        ) : null}

        <View style={styles.totalsRow}>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>TOTAL PROYECTO</Text>
            <Text style={styles.totalValue}>
              {fmtDuration(projTotals.total + (isRunningHere ? elapsed : 0))}
            </Text>
          </View>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>ESTA SEMANA</Text>
            <Text style={styles.totalValue}>
              {fmtDuration(projTotals.week + (isRunningHere ? elapsed : 0))}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.listTitle}>Sesiones</Text>
      {projEntries.length === 0 ? (
        <Text style={styles.empty}>Todavía no registraste sesiones en este proyecto.</Text>
      ) : (
        projEntries.map((e) => {
          const start = new Date(e.inicio);
          const end = new Date(e.fin);
          const isOpen = expandedEntry === e._id;
          const pausas = Array.isArray(e.pausas) ? e.pausas : [];
          return (
            <View key={e._id} style={styles.entryWrap}>
              <View style={[styles.entryItem, isOpen && styles.entryItemOpen]}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => toggleExpand(e)} activeOpacity={0.7}>
                  <Text style={styles.entryDesc}>
                    {e.descripcion || "Sin descripción"}
                  </Text>
                  <Text style={styles.entryTime}>
                    {isSameDay(start, new Date())
                      ? "Hoy"
                      : start.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}{" "}
                    · {pad(start.getHours())}:{pad(start.getMinutes())} – {pad(end.getHours())}:
                    {pad(end.getMinutes())}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.entryDur}>{fmtDuration(e.duracion)}</Text>
                <View>
                  <TouchableOpacity onPress={() => setMenuFor(menuFor === e._id ? null : e._id)} hitSlop={8}>
                    <Ionicons name="ellipsis-vertical" size={18} color={colors.muted} />
                  </TouchableOpacity>
                  {menuFor === e._id ? (
                    <View style={styles.menu}>
                      <TouchableOpacity style={styles.menuItem} onPress={() => handleDeleteEntry(e._id)}>
                        <Ionicons name="trash-outline" size={16} color="#e5533c" />
                        <Text style={styles.menuText}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </View>

              {isOpen ? (
                <View style={styles.entryDetail}>
                  {pausas.length ? (
                    <>
                      <Text style={styles.detailLabel}>PAUSAS</Text>
                      {pausas.map((p, i) => {
                        const pi = new Date(p.inicio);
                        const pf = new Date(p.fin);
                        const dur = Math.max(0, Math.round((pf - pi) / 1000));
                        return (
                          <Text key={i} style={styles.pausaRow}>
                            ⏸ {pad(pi.getHours())}:{pad(pi.getMinutes())} → {pad(pf.getHours())}:
                            {pad(pf.getMinutes())} · {fmtDuration(dur)}
                          </Text>
                        );
                      })}
                    </>
                  ) : (
                    <Text style={styles.detailMuted}>Sin pausas.</Text>
                  )}

                  <TouchableOpacity
                    style={styles.collapseHead}
                    onPress={() => setEntryNotesOpen((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.detailLabel}>NOTAS</Text>
                    <Ionicons
                      name={entryNotesOpen ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={colors.muted}
                    />
                  </TouchableOpacity>
                  {entryNotesOpen ? (
                    <>
                      <TextInput
                        style={styles.notesArea}
                        value={entryNotesDraft}
                        onChangeText={setEntryNotesDraft}
                        placeholder="Notas de esta sesión…"
                        placeholderTextColor={colors.muted}
                        multiline
                      />
                      <TouchableOpacity style={styles.saveNotesBtn} onPress={() => handleSaveEntryNotes(e._id)}>
                        <Text style={styles.saveNotesText}>Guardar notas</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })
      )}

      {/* Notas del proyecto (colapsable) */}
      {openProject ? (
        <View style={styles.projectNotes}>
          <TouchableOpacity
            style={styles.collapseHead}
            onPress={() => setProjectNotesOpen((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.listTitle}>Notas del proyecto</Text>
            <Ionicons
              name={projectNotesOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.muted}
            />
          </TouchableOpacity>
          {projectNotesOpen ? (
            <>
              <TextInput
                style={[styles.notesArea, { minHeight: 90 }]}
                value={projectNotesDraft}
                onChangeText={setProjectNotesDraft}
                placeholder="Datos del cliente, pendientes, links…"
                placeholderTextColor={colors.muted}
                multiline
              />
              <TouchableOpacity style={styles.saveNotesBtn} onPress={handleSaveProjectNotes}>
                <Text style={styles.saveNotesText}>{notesSaved ? "✓ Guardado" : "Guardar notas"}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : null}

      {/* Modal Finalizar con notas */}
      <Modal visible={finishOpen} transparent animationType="fade" onRequestClose={() => setFinishOpen(false)}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setFinishOpen(false)} />
          <ScrollView
            style={{ width: "100%", flexGrow: 0 }}
            contentContainerStyle={{ justifyContent: "center" }}
            keyboardShouldPersistTaps="handled"
          >
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <Text style={styles.sheetTitle}>Finalizar sesión</Text>

            {running ? (
              <View style={styles.finishSummary}>
                <Text style={styles.finishSummaryText}>
                  Tiempo trabajado: <Text style={{ fontWeight: "800", color: colors.text }}>{fmtDuration(activeSecs(running, Date.now()))}</Text>
                </Text>
                {(() => {
                  const ps = [...((running && running.pausas) || [])];
                  if (running?.pauseStart) ps.push({ inicio: running.pauseStart, fin: new Date().toISOString(), motivo: pauseMotivo.trim() });
                  if (!ps.length) return <Text style={styles.detailMuted}>Sin pausas.</Text>;
                  return ps.map((p, i) => {
                    const pi = new Date(p.inicio);
                    const pf = new Date(p.fin);
                    const dur = Math.max(0, Math.round((pf - pi) / 1000));
                    return (
                      <Text key={i} style={styles.finishSummaryText}>
                        ⏸ {pad(pi.getHours())}:{pad(pi.getMinutes())} → {pad(pf.getHours())}:{pad(pf.getMinutes())} · {fmtDuration(dur)}
                        {p.motivo ? ` · ${p.motivo}` : ""}
                      </Text>
                    );
                  });
                })()}
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Notas (opcional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 90, textAlignVertical: "top" }]}
              value={finishNotes}
              onChangeText={setFinishNotes}
              placeholder="¿Qué hiciste en esta sesión?"
              placeholderTextColor={colors.muted}
              multiline
            />
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setFinishOpen(false)}>
                <Text style={styles.ghostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={confirmFinish} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#0e1a0e" />
                ) : (
                  <Text style={styles.saveText}>Guardar sesión</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    createRow: { flexDirection: "row", gap: 8 },
    createInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 15,
    },
    createBtn: {
      width: 50,
      borderRadius: 12,
      backgroundColor: colors.greenBright,
      alignItems: "center",
      justifyContent: "center",
    },
    runningBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: colors.greenBorder,
      backgroundColor: colors.greenSoft,
      borderRadius: 12,
      padding: 12,
    },
    runningDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.greenBright },
    runningText: { flex: 1, color: colors.text, fontSize: 13 },
    folderCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
    },
    folderName: { color: colors.text, fontWeight: "800", fontSize: 15 },
    folderMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
    folderTotal: { color: colors.greenDark, fontWeight: "800", fontSize: 15 },
    folderTrash: { padding: 4 },
    empty: { color: colors.muted, fontSize: 14, lineHeight: 20, paddingVertical: 10 },

    detailHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    backText: { color: colors.text, fontWeight: "700", fontSize: 13 },
    detailTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
    detailDate: { color: colors.muted, fontSize: 11.5, fontWeight: "600", marginTop: 1 },
    detailDelete: {
      width: 40,
      height: 40,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },

    timerCard: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 18,
      alignItems: "center",
      gap: 14,
    },
    descInput: {
      width: "100%",
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.bg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 15,
    },
    clock: { color: colors.text, fontSize: 46, fontWeight: "900", fontVariant: ["tabular-nums"] },
    bigBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 15,
      paddingHorizontal: 30,
      borderRadius: 999,
      minWidth: 200,
    },
    startBtn: { backgroundColor: colors.greenBright },
    startText: { color: "#0e1a0e", fontWeight: "800", fontSize: 16 },
    timerBtns: { flexDirection: "row", gap: 10 },
    midBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      paddingVertical: 13,
      paddingHorizontal: 20,
      borderRadius: 999,
    },
    midText: { fontWeight: "800", fontSize: 15 },
    pauseBtn: { backgroundColor: colors.cardSoft || "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: colors.cardBorder },
    resumeBtn: { backgroundColor: colors.greenBright },
    stopBtn: { backgroundColor: "#e5533c" },
    warnNote: { color: colors.muted, textAlign: "center", lineHeight: 20, fontSize: 13 },
    totalsRow: { flexDirection: "row", gap: 10, width: "100%" },
    totalCard: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.bg,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 3,
    },
    totalLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
    totalValue: { color: colors.text, fontSize: 17, fontWeight: "800" },

    listTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 4 },
    entryItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 13,
    },
    entryItemOpen: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
    entryDesc: { color: colors.text, fontSize: 14.5, fontWeight: "600" },
    entryTime: { color: colors.muted, fontSize: 12, marginTop: 2 },
    entryDur: { color: colors.greenDark, fontWeight: "800", fontSize: 14.5 },
    menu: {
      position: "absolute",
      top: 24,
      right: 0,
      zIndex: 10,
      minWidth: 140,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.bg,
      borderRadius: 12,
      padding: 5,
    },
    menuItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9, paddingHorizontal: 10 },
    menuText: { color: "#e5533c", fontWeight: "700", fontSize: 14 },

    entryWrap: { gap: 6 },
    entryDetail: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.bg,
      borderRadius: 12,
      padding: 12,
      gap: 8,
    },
    detailLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
    collapseHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    detailMuted: { color: colors.muted, fontSize: 13 },
    pausaRow: { color: colors.text, fontSize: 13 },
    notesArea: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 14,
      minHeight: 64,
      textAlignVertical: "top",
    },
    saveNotesBtn: {
      alignSelf: "flex-start",
      backgroundColor: colors.greenSoft,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
    saveNotesText: { color: colors.greenDark, fontWeight: "800", fontSize: 13 },
    projectNotes: { gap: 8, marginTop: 8 },

    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 22 },
    sheet: {
      backgroundColor: colors.bg,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 18,
      gap: 10,
    },
    sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: 4 },
    fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    input: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 15,
    },
    sheetActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 6 },
    ghostBtn: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 18,
    },
    ghostText: { color: colors.text, fontWeight: "700" },
    saveBtn: {
      backgroundColor: colors.greenBright,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 20,
    },
    saveText: { color: "#0e1a0e", fontWeight: "800" },

    topToggle: {
      flexDirection: "row",
      alignSelf: "center",
      gap: 4,
      padding: 3,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    topToggleBtn: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 999 },
    topToggleActive: { backgroundColor: colors.greenBright },
    topToggleText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
    topToggleTextActive: { color: "#0e1a0e", fontWeight: "800" },

    pauseInput: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.bg,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 14,
    },

    finishSummary: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      gap: 4,
    },
    finishSummaryText: { color: colors.muted, fontSize: 13, lineHeight: 19 },

    calWrap: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 12,
      gap: 8,
    },
    calHead: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
    calNavBtn: {
      width: 32,
      height: 32,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    calMonth: { color: colors.text, fontWeight: "800", fontSize: 15, textTransform: "capitalize", minWidth: 150, textAlign: "center" },
    calRow: { flexDirection: "row" },
    calWeekday: { flex: 1, textAlign: "center", color: colors.muted, fontSize: 11, fontWeight: "800" },
    calGrid: { flexDirection: "row", flexWrap: "wrap" },
    calCell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "transparent",
    },
    calCellMuted: { opacity: 0.32 },
    calCellHas: { backgroundColor: colors.greenSoft },
    calCellToday: { borderColor: colors.greenBorder },
    calCellSel: { borderColor: colors.greenBright, borderWidth: 2 },
    calDayNum: { color: colors.text, fontSize: 13, fontWeight: "700" },
    calDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.greenBright },
    calDetail: {
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
      paddingTop: 10,
      gap: 8,
    },
    calDetailHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    calDetailDate: { color: colors.text, fontWeight: "800", fontSize: 14, textTransform: "capitalize", flex: 1 },
    calDetailTotal: { color: colors.greenDark, fontWeight: "800" },
    calProjRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.bg,
      borderRadius: 10,
      paddingVertical: 9,
      paddingHorizontal: 11,
    },
    calProjName: { flex: 1, color: colors.text, fontWeight: "700", fontSize: 13.5 },
    calProjDur: { color: colors.greenDark, fontWeight: "800", fontSize: 13.5 },
    calHint: { color: colors.muted, fontSize: 13, lineHeight: 19, paddingVertical: 4 },
    calAddWork: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: colors.greenBorder,
      backgroundColor: colors.greenSoft,
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: 14,
    },
    calAddWorkText: { color: colors.greenDark, fontWeight: "800", fontSize: 13 },

    projChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    projChip: {
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      borderRadius: 999,
      paddingVertical: 7,
      paddingHorizontal: 12,
    },
    projChipActive: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
    projChipText: { color: colors.muted, fontWeight: "700", fontSize: 12.5 },
    projChipTextActive: { color: colors.greenDark },
    timeRow: { flexDirection: "row", gap: 10 },
  });
