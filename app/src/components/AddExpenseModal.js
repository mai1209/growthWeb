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
import { sharedGroupsService } from "../api";
import { useTheme } from "../theme";

const pad = (n) => String(n).padStart(2, "0");
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const parseYMD = (value) => {
  if (!value) return new Date();
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

export default function AddExpenseModal({
  visible,
  groupId,
  participants = [],
  editExpense = null,
  onClose,
  onSaved,
}) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const isEdit = !!editExpense;
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [selected, setSelected] = useState([]);
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      if (editExpense) {
        setDescription(editExpense.description || "");
        setAmount(String(editExpense.amount ?? ""));
        setPaidBy(editExpense.paidByEmail || participants[0]?.email || "");
        setSelected(
          editExpense.participantEmails?.length
            ? editExpense.participantEmails
            : participants.map((p) => p.email)
        );
        setDate(parseYMD(editExpense.date));
      } else {
        setDescription("");
        setAmount("");
        setPaidBy(participants[0]?.email || "");
        setSelected(participants.map((p) => p.email)); // todos por defecto
        setDate(new Date());
      }
      setError("");
      setSaving(false);
    }
  }, [visible, participants, editExpense]);

  const toggle = (email) =>
    setSelected((prev) => (prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]));

  const handleSave = async () => {
    setError("");
    const amt = parseFloat(amount);
    if (!description.trim()) {
      setError("Poné una descripción.");
      return;
    }
    if (!amount || Number.isNaN(amt) || amt <= 0) {
      setError("Ingresá un monto válido.");
      return;
    }
    if (!paidBy) {
      setError("Elegí quién pagó.");
      return;
    }
    if (selected.length === 0) {
      setError("Elegí al menos un participante.");
      return;
    }
    setSaving(true);
    const payload = {
      description: description.trim(),
      amount: amt,
      paidByEmail: paidBy,
      date: toYMD(date),
      notes: editExpense?.notes || "",
      participantEmails: selected,
    };
    try {
      if (isEdit) {
        await sharedGroupsService.updateExpense(groupId, editExpense._id, payload);
      } else {
        await sharedGroupsService.createExpense(groupId, payload);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar el gasto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{isEdit ? "Editar gasto" : "Agregar gasto"}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Ej: Cena, Súper, Nafta"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Monto</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Fecha</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowDate(true)}>
              <Text style={{ color: colors.text, fontSize: 16 }}>{toYMD(date)}</Text>
            </TouchableOpacity>
            {showDate && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                themeVariant={isDark ? "dark" : "light"}
                onChange={(e, sel) => {
                  if (Platform.OS !== "ios") setShowDate(false);
                  if (sel) setDate(sel);
                }}
              />
            )}

            <Text style={styles.label}>¿Quién pagó?</Text>
            <View style={styles.wrap}>
              {participants.map((p) => (
                <TouchableOpacity
                  key={p.email}
                  style={[styles.chip, paidBy === p.email && styles.chipActive]}
                  onPress={() => setPaidBy(p.email)}
                >
                  <Text style={[styles.chipText, paidBy === p.email && styles.chipTextActive]}>
                    {p.username}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>¿Entre quiénes se divide?</Text>
            {participants.map((p) => {
              const on = selected.includes(p.email);
              return (
                <TouchableOpacity key={p.email} style={styles.partRow} onPress={() => toggle(p.email)}>
                  <Ionicons
                    name={on ? "checkbox" : "square-outline"}
                    size={22}
                    color={on ? colors.greenDark : colors.muted}
                  />
                  <Text style={styles.partName}>{p.username}</Text>
                </TouchableOpacity>
              );
            })}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>{isEdit ? "Guardar cambios" : "Guardar gasto"}</Text>
              )}
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
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
  chipText: { color: colors.muted, fontWeight: "700" },
  chipTextActive: { color: colors.greenDark },
  partRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
  },
  partName: { color: colors.text, fontWeight: "600", fontSize: 15 },
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
