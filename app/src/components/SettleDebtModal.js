import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { sharedGroupsService } from "../api";
import { useTheme } from "../theme";
import { formatMoney } from "../utils/finance";

const pad = (n) => String(n).padStart(2, "0");
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const METHODS = [
  { v: "efectivo", l: "Efectivo" },
  { v: "transferencia", l: "Transferencia" },
];

export default function SettleDebtModal({ visible, groupId, debt, onClose, onSaved }) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setPaymentMethod("efectivo");
      setDate(new Date());
      setNotes("");
      setError("");
      setSaving(false);
    }
  }, [visible]);

  const handleSave = async () => {
    if (!debt) return;
    setError("");
    setSaving(true);
    try {
      await sharedGroupsService.settleDebt(groupId, debt._id, {
        paymentMethod,
        date: toYMD(date),
        notes: notes.trim(),
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo confirmar el pago.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Confirmar pago</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {debt ? (
              <View style={styles.debtSummary}>
                <Text style={styles.debtTitle}>{debt.description}</Text>
                <Text style={styles.debtMeta}>
                  {debt.debtorName} le debe a {debt.creditorName}
                </Text>
                <Text style={styles.debtAmount}>
                  {formatMoney(debt.amount, debt.currency)}
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>¿Cómo lo pagaste?</Text>
            <View style={styles.row}>
              {METHODS.map((m) => (
                <TouchableOpacity
                  key={m.v}
                  style={[styles.toggle, paymentMethod === m.v && styles.toggleActive]}
                  onPress={() => setPaymentMethod(m.v)}
                >
                  <Text style={[styles.toggleText, paymentMethod === m.v && styles.toggleTextActive]}>
                    {m.l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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

            <Text style={styles.label}>Detalle</Text>
            <TextInput
              style={styles.input}
              value={notes}
              onChangeText={setNotes}
              placeholder="Opcional"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.hint}>
              Al confirmar se genera un egreso real en la caja de quien pagó.
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Confirmar pago</Text>}
            </TouchableOpacity>
          </View>
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
  debtSummary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 14,
  },
  debtTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  debtMeta: { color: colors.muted, fontSize: 13, marginTop: 3 },
  debtAmount: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 6 },
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
  row: { flexDirection: "row", gap: 8 },
  toggle: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  toggleActive: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder },
  toggleText: { color: colors.muted, fontWeight: "700" },
  toggleTextActive: { color: colors.greenDark },
  hint: { color: colors.muted, fontSize: 12, marginTop: 12, lineHeight: 17 },
  error: { color: colors.red, marginTop: 12 },
  saveBtn: {
    marginTop: 18,
    backgroundColor: colors.greenBright,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
