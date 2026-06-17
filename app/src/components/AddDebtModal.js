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

export default function AddDebtModal({ visible, groupId, participants = [], onClose, onSaved }) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [debtorEmail, setDebtorEmail] = useState("");
  const [creditorEmail, setCreditorEmail] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDescription("");
      setAmount("");
      setDebtorEmail(participants[0]?.email || "");
      setCreditorEmail(participants[1]?.email || "");
      setDate(new Date());
      setNotes("");
      setError("");
      setSaving(false);
    }
  }, [visible, participants]);

  const handleSave = async () => {
    setError("");
    const amt = parseFloat(amount);
    if (!description.trim()) return setError("Poné un motivo.");
    if (!amount || Number.isNaN(amt) || amt <= 0) return setError("Ingresá un monto válido.");
    if (!debtorEmail || !creditorEmail) return setError("Elegí deudor y acreedor.");
    if (debtorEmail === creditorEmail) return setError("Tienen que ser dos personas distintas.");
    setSaving(true);
    try {
      await sharedGroupsService.createDebt(groupId, {
        description: description.trim(),
        amount: amt,
        debtorEmail,
        creditorEmail,
        date: toYMD(date),
        notes: notes.trim(),
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo guardar la deuda.");
    } finally {
      setSaving(false);
    }
  };

  const PersonPicker = ({ value, onPick, exclude }) => (
    <View style={styles.wrap}>
      {participants
        .filter((p) => p.email !== exclude)
        .map((p) => (
          <TouchableOpacity
            key={p.email}
            style={[styles.chip, value === p.email && styles.chipActive]}
            onPress={() => onPick(p.email)}
          >
            <Text style={[styles.chipText, value === p.email && styles.chipTextActive]}>
              {p.username}
            </Text>
          </TouchableOpacity>
        ))}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Cargar deuda</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Motivo</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Ej: adelanto, pago prestado"
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

            <Text style={styles.label}>¿Quién debe?</Text>
            <PersonPicker value={debtorEmail} onPick={setDebtorEmail} exclude={creditorEmail} />

            <Text style={styles.label}>¿A quién?</Text>
            <PersonPicker value={creditorEmail} onPick={setCreditorEmail} exclude={debtorEmail} />

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

            <Text style={styles.label}>Notas</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: "top" }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Detalle opcional"
              placeholderTextColor={colors.muted}
              multiline
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Guardar deuda</Text>}
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
