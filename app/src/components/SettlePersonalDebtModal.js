import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { movimientoService } from "../api";
import { useTheme } from "../theme";
import { formatMoney } from "../utils/finance";

export default function SettlePersonalDebtModal({ visible, debt, onClose, onSaved }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [payMode, setPayMode] = useState("full"); // full | partial
  const [amount, setAmount] = useState("");
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const currency = debt?.moneda || "ARS";
  const total = Number(debt?.monto) || 0;
  const paidSoFar = Number(debt?.deudaPagado) || 0;
  const remaining = Number((total - paidSoFar).toFixed(2));

  useEffect(() => {
    if (visible) {
      setPayMode("full");
      setAmount("");
      setDetalle(
        debt?.deudaAcreedor ? `Pago de deuda a ${debt.deudaAcreedor}` : "Pago de deuda"
      );
      setError("");
      setSaving(false);
    }
  }, [visible, debt]);

  const handleSave = async () => {
    if (!debt) return;
    setError("");
    const payload = { detalle: detalle.trim() };
    if (payMode === "partial") {
      const amt = parseFloat(amount);
      if (!amount || Number.isNaN(amt) || amt <= 0) {
        return setError("Ingresá el monto a pagar.");
      }
      if (amt > remaining + 0.001) {
        return setError(`No podés pagar más de lo que resta (${formatMoney(remaining, currency)}).`);
      }
      payload.amount = amt;
    }
    setSaving(true);
    try {
      await movimientoService.settleDebt(debt._id, payload);
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
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Pagar deuda</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            {debt ? (
              <View style={styles.debtSummary}>
                <Text style={styles.debtTitle}>{debt.categoria || "Deuda"}</Text>
                {debt.deudaAcreedor ? (
                  <Text style={styles.debtMeta}>Acreedor: {debt.deudaAcreedor}</Text>
                ) : null}
                <Text style={styles.debtAmount}>{formatMoney(total, currency)}</Text>
                {paidSoFar > 0 ? (
                  <Text style={styles.debtRemaining}>
                    Pagado {formatMoney(paidSoFar, currency)} · resta {formatMoney(remaining, currency)}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.label}>¿Cuánto pagás?</Text>
            <View style={styles.row}>
              {[
                { v: "full", l: "Todo" },
                { v: "partial", l: "Una parte" },
              ].map((m) => (
                <TouchableOpacity
                  key={m.v}
                  style={[styles.toggle, payMode === m.v && styles.toggleActive]}
                  onPress={() => setPayMode(m.v)}
                >
                  <Text style={[styles.toggleText, payMode === m.v && styles.toggleTextActive]}>
                    {m.l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {payMode === "partial" && (
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                placeholder={`Monto (máx ${formatMoney(remaining, currency)})`}
                placeholderTextColor={colors.muted}
                autoFocus
              />
            )}

            <Text style={styles.label}>Detalle</Text>
            <TextInput
              style={styles.input}
              value={detalle}
              onChangeText={setDetalle}
              placeholder="Opcional"
              placeholderTextColor={colors.muted}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Aceptar</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: "92%",
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
  debtRemaining: { color: colors.greenDark, fontSize: 13, fontWeight: "700", marginTop: 4 },
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
