import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Vibration,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import * as SecureStore from "expo-secure-store";
import { useTheme } from "../theme";

// DIAGNÓSTICO: sonido desactivado temporalmente para aislar el crash de Android

const MODES = [
  { key: "focus", label: "Enfoque", def: 25 },
  { key: "short", label: "Descanso", def: 5 },
  { key: "long", label: "Descanso largo", def: 15 },
];

const SETTINGS_KEY = "gm_pomodoro_settings";
const NOTES_KEY = "gm_pomodoro_notes";
const COUNT_KEY = "gm_pomodoro_count";

const todayKey = () => new Date().toISOString().slice(0, 10);
const fmt = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export default function PomodoroScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [durations, setDurations] = useState({ focus: 25, short: 5, long: 15 });
  const [longBreakInterval, setLongBreakInterval] = useState(4);
  const [autoStartBreaks, setAutoStartBreaks] = useState(true);
  const [autoStartPomodoros, setAutoStartPomodoros] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [vibrateOn, setVibrateOn] = useState(true);
  const [mode, setMode] = useState("focus");
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(25 * 60);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [completed, setCompleted] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const targetRef = useRef(null);
  const totalSecs = durations[mode] * 60;

  // DIAGNÓSTICO: alarma stub (sin expo-audio) mientras aislamos el crash
  const alarm = { seekTo() {}, play() {} };

  // Cargar guardado
  useEffect(() => {
    (async () => {
      try {
        const [s, n, c] = await Promise.all([
          SecureStore.getItemAsync(SETTINGS_KEY),
          SecureStore.getItemAsync(NOTES_KEY),
          SecureStore.getItemAsync(COUNT_KEY),
        ]);
        if (s) {
          const d = JSON.parse(s);
          setDurations({ focus: d.focus || 25, short: d.short || 5, long: d.long || 15 });
          setRemaining((d.focus || 25) * 60);
          setLongBreakInterval(d.longBreakInterval || 4);
          setAutoStartBreaks(d.autoStartBreaks !== undefined ? d.autoStartBreaks : true);
          setAutoStartPomodoros(d.autoStartPomodoros !== undefined ? d.autoStartPomodoros : true);
          setSoundOn(d.soundOn !== undefined ? d.soundOn : true);
          setVibrateOn(d.vibrateOn !== undefined ? d.vibrateOn : true);
        }
        if (n) setNotes(JSON.parse(n));
        if (c) {
          const parsed = JSON.parse(c);
          if (parsed.date === todayKey()) setCompleted(parsed.count || 0);
        }
      } catch {
        // valores por defecto
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // Persistir (duraciones + configuración)
  useEffect(() => {
    if (!hydrated) return;
    const payload = {
      ...durations,
      longBreakInterval,
      autoStartBreaks,
      autoStartPomodoros,
      soundOn,
      vibrateOn,
    };
    SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(payload)).catch(() => {});
  }, [durations, longBreakInterval, autoStartBreaks, autoStartPomodoros, soundOn, vibrateOn, hydrated]);
  useEffect(() => {
    if (hydrated) SecureStore.setItemAsync(NOTES_KEY, JSON.stringify(notes)).catch(() => {});
  }, [notes, hydrated]);
  useEffect(() => {
    if (hydrated)
      SecureStore.setItemAsync(COUNT_KEY, JSON.stringify({ date: todayKey(), count: completed })).catch(
        () => {}
      );
  }, [completed, hydrated]);

  const handleComplete = useCallback(() => {
    if (soundOn) {
      try {
        alarm.seekTo(0);
        alarm.play();
      } catch {
        // audio no disponible
      }
    }
    if (vibrateOn) Vibration.vibrate([0, 400, 150, 400]);
    targetRef.current = null;
    let next;
    let autostart;
    if (mode === "focus") {
      const newCount = completed + 1;
      setCompleted(newCount);
      const interval = Math.max(1, longBreakInterval);
      next = newCount % interval === 0 ? "long" : "short";
      autostart = autoStartBreaks;
    } else {
      next = "focus";
      autostart = autoStartPomodoros;
    }
    setMode(next);
    setRemaining(durations[next] * 60);
    setRunning(autostart);
  }, [mode, completed, durations, longBreakInterval, autoStartBreaks, autoStartPomodoros, soundOn, vibrateOn, alarm]);

  // Tick por timestamp
  useEffect(() => {
    if (!running) return undefined;
    if (targetRef.current == null) targetRef.current = Date.now() + remaining * 1000;
    const id = setInterval(() => {
      const left = Math.round((targetRef.current - Date.now()) / 1000);
      if (left <= 0) {
        setRemaining(0);
        handleComplete();
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, handleComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchMode = (key) => {
    setRunning(false);
    targetRef.current = null;
    setMode(key);
    setRemaining(durations[key] * 60);
  };

  const toggleRun = () => {
    if (running) {
      targetRef.current = null;
      setRunning(false);
    } else {
      targetRef.current = Date.now() + remaining * 1000;
      setRunning(true);
    }
  };

  const reset = () => {
    setRunning(false);
    targetRef.current = null;
    setRemaining(durations[mode] * 60);
  };

  const changeDuration = (key, delta) => {
    setDurations((d) => {
      const val = Math.min(90, Math.max(1, d[key] + delta));
      const next = { ...d, [key]: val };
      if (key === mode && !running) setRemaining(val * 60);
      return next;
    });
  };

  const addNote = () => {
    const text = noteText.trim();
    if (!text) return;
    setNotes((n) => [{ id: `${Date.now()}`, text, done: false }, ...n]);
    setNoteText("");
  };
  const toggleNote = (id) =>
    setNotes((n) => n.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  const deleteNote = (id) => setNotes((n) => n.filter((it) => it.id !== id));

  // Anillo
  const R = 98;
  const RING = 230;
  const RC = RING / 2;
  const CIRC = 2 * Math.PI * R;
  const progress = totalSecs > 0 ? remaining / totalSecs : 0;
  const dashOffset = CIRC * (1 - progress);
  const modeLabel = MODES.find((m) => m.key === mode)?.label || "";

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>POMODORO</Text>
            <Text style={styles.title}>Enfoque</Text>
          </View>
          <TouchableOpacity style={styles.gearBtn} onPress={() => setSettingsOpen(true)} hitSlop={8}>
            <Ionicons name="settings-outline" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Modos */}
        <View style={styles.modeRow}>
          {MODES.map((m) => {
            const active = mode === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.modeBtn, active && styles.modeBtnActive]}
                onPress={() => switchMode(m.key)}
              >
                <Text style={[styles.modeText, active && styles.modeTextActive]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Anillo + tiempo */}
        <View style={styles.ringWrap}>
          <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
            <Circle
              cx={RC}
              cy={RC}
              r={R}
              stroke={colors.greenSoft}
              strokeWidth={11}
              fill="none"
            />
            <Circle
              cx={RC}
              cy={RC}
              r={R}
              stroke={colors.greenBright}
              strokeWidth={11}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${RC} ${RC})`}
            />
          </Svg>
          <Text style={styles.time}>{fmt(remaining)}</Text>
          <Text style={styles.timeLabel}>{modeLabel}</Text>
        </View>

        {/* Controles */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.primaryBtn} onPress={toggleRun}>
            <Ionicons name={running ? "pause" : "play"} size={20} color="#fff" />
            <Text style={styles.primaryText}>{running ? "Pausar" : "Iniciar"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={reset}>
            <Ionicons name="refresh" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleComplete}>
            <Ionicons name="play-skip-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={styles.counter}>
          Pomodoros completados hoy: <Text style={styles.counterNum}>{completed}</Text>
        </Text>

        {/* Duraciones */}
        <View style={styles.settings}>
          {MODES.map((m) => (
            <View key={m.key} style={styles.settingField}>
              <Text style={styles.settingLabel}>{m.label}</Text>
              <View style={styles.stepper}>
                <TouchableOpacity style={styles.stepBtn} onPress={() => changeDuration(m.key, -1)}>
                  <Text style={styles.stepSign}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepVal}>{durations[m.key]}</Text>
                <TouchableOpacity style={styles.stepBtn} onPress={() => changeDuration(m.key, 1)}>
                  <Text style={styles.stepSign}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Notas */}
        <View style={styles.notesCard}>
          <Text style={styles.notesTitle}>Notas de la sesión</Text>
          <View style={styles.noteForm}>
            <TextInput
              style={styles.noteInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="¿En qué estás trabajando?"
              placeholderTextColor={colors.muted}
              maxLength={140}
              onSubmitEditing={addNote}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addBtn} onPress={addNote}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {notes.length === 0 ? (
            <Text style={styles.emptyNotes}>Sin notas todavía. Anotá tu objetivo del bloque.</Text>
          ) : (
            notes.map((it) => (
              <View key={it.id} style={styles.noteItem}>
                <TouchableOpacity onPress={() => toggleNote(it.id)} hitSlop={8}>
                  <Ionicons
                    name={it.done ? "checkbox" : "square-outline"}
                    size={22}
                    color={it.done ? colors.greenDark : colors.muted}
                  />
                </TouchableOpacity>
                <Text style={[styles.noteTextItem, it.done && styles.noteDone]}>{it.text}</Text>
                <TouchableOpacity onPress={() => deleteNote(it.id)} hitSlop={8}>
                  <Ionicons name="close" size={18} color={colors.muted} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal de ajustes */}
      <Modal visible={settingsOpen} animationType="slide" transparent onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Ajustes</Text>
              <TouchableOpacity onPress={() => setSettingsOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingRowLabel}>Descanso largo cada</Text>
              <View style={styles.stepperInline}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setLongBreakInterval((v) => Math.max(1, v - 1))}
                >
                  <Text style={styles.stepSign}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepVal}>{longBreakInterval}</Text>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setLongBreakInterval((v) => Math.min(12, v + 1))}
                >
                  <Text style={styles.stepSign}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingRowLabel}>Auto-iniciar descansos</Text>
              <Switch value={autoStartBreaks} onToggle={() => setAutoStartBreaks((v) => !v)} colors={colors} />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingRowLabel}>Auto-iniciar pomodoros</Text>
              <Switch value={autoStartPomodoros} onToggle={() => setAutoStartPomodoros((v) => !v)} colors={colors} />
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingRowLabel}>Sonido al terminar</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {soundOn ? (
                  <TouchableOpacity
                    onPress={() => {
                      try {
                        alarm.seekTo(0);
                        alarm.play();
                      } catch {}
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="volume-high-outline" size={20} color={colors.greenDark} />
                  </TouchableOpacity>
                ) : null}
                <Switch value={soundOn} onToggle={() => setSoundOn((v) => !v)} colors={colors} />
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingRowLabel}>Vibrar al terminar</Text>
              <Switch value={vibrateOn} onToggle={() => setVibrateOn((v) => !v)} colors={colors} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Interruptor simple (sin dependencias)
function Switch({ value, onToggle, colors }) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.8}
      style={{
        width: 46,
        height: 27,
        borderRadius: 999,
        padding: 3,
        backgroundColor: value ? colors.segActive : colors.cardSoft,
        borderWidth: 1,
        borderColor: value ? colors.segActive : colors.cardBorder,
        alignItems: value ? "flex-end" : "flex-start",
      }}
    >
      <View
        style={{
          width: 19,
          height: 19,
          borderRadius: 999,
          backgroundColor: "#fff",
        }}
      />
    </TouchableOpacity>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: 16, paddingBottom: 100 },
    header: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
    gearBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    kicker: {
      color: colors.green,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.5,
    },
    title: { color: colors.text, fontSize: 26, fontWeight: "900", marginTop: 2 },
    modeRow: { flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 8 },
    modeBtn: {
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    modeBtnActive: { backgroundColor: colors.segActive, borderColor: colors.segActive },
    modeText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
    modeTextActive: { color: colors.segActiveText, fontWeight: "800" },
    ringWrap: {
      width: 230,
      height: 230,
      alignSelf: "center",
      marginTop: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    time: { color: colors.text, fontSize: 46, fontWeight: "800", fontVariant: ["tabular-nums"] },
    timeLabel: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1,
      marginTop: 4,
    },
    controls: {
      flexDirection: "row",
      gap: 12,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 24,
    },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.greenBright,
      paddingVertical: 14,
      paddingHorizontal: 32,
      borderRadius: 999,
    },
    primaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
    iconBtn: {
      width: 50,
      height: 50,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    counter: { textAlign: "center", color: colors.muted, marginTop: 18, fontSize: 14 },
    counterNum: { color: colors.greenDark, fontWeight: "800", fontSize: 16 },
    settings: { flexDirection: "row", gap: 10, marginTop: 22 },
    settingField: { flex: 1, alignItems: "center", gap: 6 },
    settingLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", textAlign: "center" },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      backgroundColor: colors.card,
      width: "100%",
    },
    stepBtn: { width: 38, height: 40, alignItems: "center", justifyContent: "center" },
    stepSign: { color: colors.greenDark, fontSize: 20, fontWeight: "800" },
    stepVal: { color: colors.text, fontWeight: "800", fontSize: 16 },
    notesCard: {
      marginTop: 24,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
    },
    notesTitle: { color: colors.text, fontSize: 17, fontWeight: "800", marginBottom: 12 },
    noteForm: { flexDirection: "row", gap: 8, marginBottom: 12 },
    noteInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.bg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 15,
    },
    addBtn: {
      width: 46,
      borderRadius: 12,
      backgroundColor: colors.greenBright,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyNotes: { color: colors.muted, fontSize: 14, textAlign: "center", paddingVertical: 14 },
    noteItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.bg,
      borderRadius: 12,
      marginBottom: 8,
    },
    noteTextItem: { flex: 1, color: colors.text, fontSize: 15 },
    noteDone: { textDecorationLine: "line-through", color: colors.muted },

    // Modal de ajustes
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 34,
    },
    sheetHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
    },
    sheetTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    settingRowLabel: { color: colors.text, fontSize: 15, fontWeight: "600", flex: 1 },
    stepperInline: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 10,
      backgroundColor: colors.card,
    },
  });
