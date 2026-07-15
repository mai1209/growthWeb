import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { timeEntryService } from "../api";

const RUNNING_KEY = "gm_timetracker_running";

const pad = (n) => String(n).padStart(2, "0");

const fmtDuration = (secs) => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(sec)}s`;
  return `${sec}s`;
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
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
};
const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

export default function TimeTrackerPanel({ colors }) {
  const styles = makeStyles(colors);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [descripcion, setDescripcion] = useState("");
  const [running, setRunning] = useState(null); // { startedAt, descripcion }
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualDesc, setManualDesc] = useState("");
  const [manualMin, setManualMin] = useState("");

  const tickRef = useRef(null);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await timeEntryService.getAll();
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(RUNNING_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.startedAt) {
            setRunning(parsed);
            setDescripcion(parsed.descripcion || "");
          }
        }
      } catch {
        // nada
      }
    })();
  }, [fetchEntries]);

  useEffect(() => {
    if (!running) {
      if (tickRef.current) clearInterval(tickRef.current);
      return undefined;
    }
    setNow(Date.now());
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  const elapsed = running
    ? Math.floor((now - new Date(running.startedAt).getTime()) / 1000)
    : 0;

  const handleStart = async () => {
    const payload = { startedAt: new Date().toISOString(), descripcion: descripcion.trim() };
    setRunning(payload);
    try {
      await SecureStore.setItemAsync(RUNNING_KEY, JSON.stringify(payload));
    } catch {
      // nada
    }
  };

  const handleStop = async () => {
    if (!running || saving) return;
    setSaving(true);
    try {
      await timeEntryService.create({
        descripcion: running.descripcion || descripcion.trim(),
        inicio: running.startedAt,
        fin: new Date().toISOString(),
      });
      setRunning(null);
      setDescripcion("");
      await SecureStore.deleteItemAsync(RUNNING_KEY);
      await fetchEntries();
    } catch {
      Alert.alert("Error", "No se pudo guardar la sesión.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
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

  const submitManual = async () => {
    const mins = parseInt(manualMin, 10);
    if (!mins || mins <= 0) {
      Alert.alert("Faltan datos", "Ingresá los minutos trabajados.");
      return;
    }
    const fin = new Date();
    const inicio = new Date(fin.getTime() - mins * 60 * 1000);
    try {
      await timeEntryService.create({
        descripcion: manualDesc.trim(),
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
      });
      setManualOpen(false);
      setManualDesc("");
      setManualMin("");
      await fetchEntries();
    } catch {
      Alert.alert("Error", "No se pudo guardar el registro.");
    }
  };

  const { todayEntries, todayTotal, weekTotal } = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today);
    let dToday = 0;
    let dWeek = 0;
    const tEntries = [];
    entries.forEach((e) => {
      const start = new Date(e.inicio);
      const dur = Number(e.duracion) || 0;
      if (start >= weekStart) dWeek += dur;
      if (isSameDay(start, today)) {
        dToday += dur;
        tEntries.push(e);
      }
    });
    return { todayEntries: tEntries, todayTotal: dToday, weekTotal: dWeek };
  }, [entries]);

  return (
    <View style={styles.wrap}>
      <View style={styles.timerCard}>
        <TextInput
          style={styles.descInput}
          value={descripcion}
          onChangeText={setDescripcion}
          placeholder="¿En qué estás trabajando?"
          placeholderTextColor={colors.muted}
          editable={!running}
          maxLength={160}
        />

        <Text style={styles.clock}>{fmtClock(elapsed)}</Text>

        {running ? (
          <TouchableOpacity
            style={[styles.bigBtn, styles.stopBtn]}
            onPress={handleStop}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="stop" size={20} color="#fff" />
                <Text style={styles.stopText}>Detener y guardar</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.bigBtn, styles.startBtn]}
            onPress={handleStart}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={20} color="#0e1a0e" />
            <Text style={styles.startText}>Iniciar</Text>
          </TouchableOpacity>
        )}

        <View style={styles.totalsRow}>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>HOY</Text>
            <Text style={styles.totalValue}>
              {fmtDuration(todayTotal + (running ? elapsed : 0))}
            </Text>
          </View>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>ESTA SEMANA</Text>
            <Text style={styles.totalValue}>
              {fmtDuration(weekTotal + (running ? elapsed : 0))}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.listHead}>
        <Text style={styles.listTitle}>Sesiones de hoy</Text>
        <TouchableOpacity style={styles.manualBtn} onPress={() => setManualOpen(true)}>
          <Ionicons name="add" size={16} color={colors.greenDark} />
          <Text style={styles.manualText}>Cargar manual</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.green} style={{ marginTop: 16 }} />
      ) : todayEntries.length === 0 ? (
        <Text style={styles.empty}>
          Todavía no registraste horas hoy. Tocá Iniciar o cargá una sesión manual.
        </Text>
      ) : (
        todayEntries.map((e) => {
          const start = new Date(e.inicio);
          const end = new Date(e.fin);
          return (
            <View key={e._id} style={styles.entryItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryDesc}>{e.descripcion || "Sin descripción"}</Text>
                <Text style={styles.entryTime}>
                  {pad(start.getHours())}:{pad(start.getMinutes())} – {pad(end.getHours())}:
                  {pad(end.getMinutes())}
                </Text>
              </View>
              <Text style={styles.entryDur}>{fmtDuration(e.duracion)}</Text>
              <TouchableOpacity onPress={() => handleDelete(e._id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.muted} />
              </TouchableOpacity>
            </View>
          );
        })
      )}

      <Modal visible={manualOpen} transparent animationType="fade" onRequestClose={() => setManualOpen(false)}>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setManualOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <Text style={styles.sheetTitle}>Cargar sesión manual</Text>
            <Text style={styles.fieldLabel}>¿En qué trabajaste?</Text>
            <TextInput
              style={styles.input}
              value={manualDesc}
              onChangeText={setManualDesc}
              placeholder="Ej: Diseño landing"
              placeholderTextColor={colors.muted}
              maxLength={160}
            />
            <Text style={styles.fieldLabel}>Minutos trabajados</Text>
            <TextInput
              style={styles.input}
              value={manualMin}
              onChangeText={(t) => setManualMin(t.replace(/[^\d]/g, ""))}
              placeholder="Ej: 45"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
            />
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setManualOpen(false)}>
                <Text style={styles.ghostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={submitManual}>
                <Text style={styles.saveText}>Guardar</Text>
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
    wrap: { gap: 14 },
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
    clock: {
      color: colors.text,
      fontSize: 48,
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
    },
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
    stopBtn: { backgroundColor: "#e5533c" },
    stopText: { color: "#fff", fontWeight: "800", fontSize: 16 },
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
    totalValue: { color: colors.text, fontSize: 18, fontWeight: "800" },
    listHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    listTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
    manualBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 1,
      borderColor: colors.greenBorder,
      backgroundColor: colors.greenSoft,
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    manualText: { color: colors.greenDark, fontWeight: "700", fontSize: 12.5 },
    empty: { color: colors.muted, fontSize: 14, lineHeight: 20, paddingVertical: 10 },
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
