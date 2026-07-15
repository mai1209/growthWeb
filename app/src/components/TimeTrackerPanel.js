import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
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
  const [projectNotesDraft, setProjectNotesDraft] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
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
    if (running.pauseStart) pausas.push({ inicio: running.pauseStart, fin: new Date().toISOString() });
    persistRunning({ ...running, segmentStart: new Date().toISOString(), pauseStart: null, pausas });
  };
  const confirmFinish = async () => {
    if (!running || saving) return;
    setSaving(true);
    const total = activeSecs(running, Date.now());
    const pausas = [...(running.pausas || [])];
    if (running.pauseStart) pausas.push({ inicio: running.pauseStart, fin: new Date().toISOString() });
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

  const handleDeleteProject = (project) => {
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
          } catch {
            Alert.alert("Error", "No se pudo eliminar el proyecto.");
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

  const runningProject = running
    ? running.proyecto
      ? projects.find((p) => p._id === running.proyecto)
      : { nombre: "Sin proyecto" }
    : null;
  const elapsed = activeSecs(running, now);

  // ---------- Vista carpetas ----------
  if (openProject === undefined) {
    const noneTotals = totals.get(NO_PROJECT);
    return (
      <View style={styles.wrap}>
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
          <Ionicons name="chevron-back" size={16} color={colors.text} />
          <Text style={styles.backText}>Proyectos</Text>
        </TouchableOpacity>
        <Text style={styles.detailTitle} numberOfLines={1}>
          {projName}
        </Text>
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
              <View style={styles.entryItem}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => toggleExpand(e)} activeOpacity={0.7}>
                  <Text style={styles.entryDesc}>
                    {e.descripcion || "Sin descripción"}
                    {e.notas ? "  📝" : ""}
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

                  <Text style={styles.detailLabel}>NOTAS</Text>
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
                </View>
              ) : null}
            </View>
          );
        })
      )}

      {/* Notas del proyecto */}
      {openProject ? (
        <View style={styles.projectNotes}>
          <Text style={styles.listTitle}>Notas del proyecto</Text>
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
        </View>
      ) : null}

      {/* Modal Finalizar con notas */}
      <Modal visible={finishOpen} transparent animationType="fade" onRequestClose={() => setFinishOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setFinishOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <Text style={styles.sheetTitle}>Finalizar sesión</Text>
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
        </TouchableOpacity>
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
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    backText: { color: colors.text, fontWeight: "700", fontSize: 13 },
    detailTitle: { color: colors.text, fontSize: 18, fontWeight: "800", flex: 1 },

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
  });
