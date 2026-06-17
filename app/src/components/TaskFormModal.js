import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { taskService } from "../api";
import { useTheme } from "../theme";

const MOMENTOS = [
  { value: "Mañana", label: "Mañana", icon: "sunny-outline" },
  { value: "Tarde", label: "Tarde", icon: "partly-sunny-outline" },
  { value: "Noche", label: "Noche", icon: "moon-outline" },
  { value: "", label: "Indiferente", icon: "remove-outline" },
];

const URGENCIAS = ["importante", "urgente", "no importante", "obligaciones"];

export const TASK_COLORS = {
  color1: "#5dc72d",
  color2: "#ff7a35",
  color3: "#f0c419",
  color4: "#35c981",
  color5: "#3f9fe7",
  color6: "#ea5e9a",
  color7: "#8b6ee8",
  color8: "#e05252",
  color9: "#8e9baa",
  color10: "#dfe6d4",
};

const DAYS = ["D", "L", "M", "MI", "J", "V", "S"];

const pad = (n) => String(n).padStart(2, "0");
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function TaskFormModal({ visible, defaultDate, onClose, onSaved }) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const [meta, setMeta] = useState("");
  const [fecha, setFecha] = useState(defaultDate || new Date());
  const [showDate, setShowDate] = useState(false);
  const [momento, setMomento] = useState("");
  const [useExact, setUseExact] = useState(false);
  const [exactTime, setExactTime] = useState(new Date());
  const [showTime, setShowTime] = useState(false);
  const [urgencia, setUrgencia] = useState("importante");
  const [color, setColor] = useState("color1");
  const [esRecurrente, setEsRecurrente] = useState(false);
  const [dias, setDias] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setMeta("");
      setFecha(defaultDate || new Date());
      setMomento("");
      setUseExact(false);
      setExactTime(new Date());
      setUrgencia("importante");
      setColor("color1");
      setEsRecurrente(false);
      setDias([]);
      setError("");
      setSaving(false);
    }
  }, [visible, defaultDate]);

  const toggleDay = (d) =>
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const handleSave = async () => {
    setError("");
    if (!meta.trim()) {
      setError("Escribí la tarea.");
      return;
    }
    setSaving(true);
    try {
      const horario = useExact
        ? `${pad(exactTime.getHours())}:${pad(exactTime.getMinutes())}`
        : momento;
      await taskService.create({
        meta: meta.trim(),
        tipo: "task",
        contenido: "",
        fecha: toYMD(fecha),
        horario,
        urgencia,
        color,
        esRecurrente,
        diasRepeticion: esRecurrente ? dias : [],
        workspace: "personal",
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || "No se pudo guardar la tarea.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Nueva tarea</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Tarea</Text>
            <TextInput
              style={styles.input}
              value={meta}
              onChangeText={setMeta}
              placeholder="Ej: Revisar pedidos"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Fecha</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowDate(true)}>
              <Text style={{ color: colors.text, fontSize: 16 }}>{toYMD(fecha)}</Text>
            </TouchableOpacity>
            {showDate && (
              <DateTimePicker
                value={fecha}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                themeVariant={isDark ? "dark" : "light"}
                onChange={(e, sel) => {
                  if (Platform.OS !== "ios") setShowDate(false);
                  if (sel) setFecha(sel);
                }}
              />
            )}

            <Text style={styles.label}>Momento</Text>
            <View style={styles.wrap}>
              {MOMENTOS.map((m) => {
                const active = !useExact && momento === m.value;
                return (
                  <TouchableOpacity
                    key={m.label}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => {
                      setUseExact(false);
                      setMomento(m.value);
                    }}
                  >
                    <Ionicons name={m.icon} size={15} color={active ? colors.greenDark : colors.muted} />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[styles.chip, useExact && styles.chipActive]}
                onPress={() => {
                  setUseExact(true);
                  setShowTime(true);
                }}
              >
                <Ionicons name="time-outline" size={15} color={useExact ? colors.greenDark : colors.muted} />
                <Text style={[styles.chipText, useExact && styles.chipTextActive]}>
                  {useExact ? `${pad(exactTime.getHours())}:${pad(exactTime.getMinutes())}` : "Hora exacta"}
                </Text>
              </TouchableOpacity>
            </View>
            {showTime && (
              <DateTimePicker
                value={exactTime}
                mode="time"
                is24Hour
                display={Platform.OS === "ios" ? "spinner" : "default"}
                themeVariant={isDark ? "dark" : "light"}
                onChange={(e, sel) => {
                  if (Platform.OS !== "ios") setShowTime(false);
                  if (sel) {
                    setExactTime(sel);
                    setUseExact(true);
                  }
                }}
              />
            )}

            <Text style={styles.label}>Prioridad</Text>
            <View style={styles.wrap}>
              {URGENCIAS.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.chip, urgencia === u && styles.chipActive]}
                  onPress={() => setUrgencia(u)}
                >
                  <Text style={[styles.chipText, urgencia === u && styles.chipTextActive, { textTransform: "capitalize" }]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Color</Text>
            <View style={styles.colorRow}>
              {Object.entries(TASK_COLORS)
                .filter(([key]) => key !== "color10") // el blanco no se lee con texto blanco
                .map(([key, val]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.colorDot,
                      { backgroundColor: val },
                      color === key && styles.colorDotActive,
                    ]}
                    onPress={() => setColor(key)}
                  />
                ))}
            </View>

            <TouchableOpacity
              style={styles.repeatRow}
              onPress={() => setEsRecurrente((v) => !v)}
            >
              <Ionicons
                name={esRecurrente ? "checkbox" : "square-outline"}
                size={22}
                color={esRecurrente ? colors.greenDark : colors.muted}
              />
              <Text style={styles.repeatText}>Repetir tarea</Text>
            </TouchableOpacity>

            {esRecurrente && (
              <View style={[styles.wrap, { marginTop: 12 }]}>
                {DAYS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dayChip, dias.includes(d) && styles.chipActive]}
                    onPress={() => toggleDay(d)}
                  >
                    <Text style={[styles.chipText, dias.includes(d) && styles.chipTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Crear tarea</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(11,20,15,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: "800" },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 16,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  dayChip: {
    width: 42,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
  chipText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  chipTextActive: { color: colors.greenDark },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotActive: { borderWidth: 3, borderColor: colors.text },
  repeatRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18 },
  repeatText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  error: { color: colors.red, marginTop: 12 },
  saveBtn: {
    marginTop: 22,
    backgroundColor: colors.greenBright,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
