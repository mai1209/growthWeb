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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { sharedGroupsService } from "../api";
import { useTheme } from "../theme";

export default function AddMemberModal({ visible, groupId, onClose, onSaved }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [mode, setMode] = useState("guest"); // guest | linked
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [historyMode, setHistoryMode] = useState("future"); // future | all
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setMode("guest");
      setName("");
      setEmail("");
      setHistoryMode("future");
      setError("");
      setSaving(false);
    }
  }, [visible]);

  const handleSave = async () => {
    setError("");
    if (mode === "guest" && !name.trim()) return setError("Poné el nombre del invitado.");
    if (mode === "linked" && !email.trim()) return setError("Cargá el email a vincular.");
    setSaving(true);
    try {
      await sharedGroupsService.addMember(groupId, {
        mode,
        username: name.trim(),
        email: email.trim(),
        historyMode,
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo sumar el miembro.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Sumar miembro</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.row}>
              {[
                { v: "guest", l: "Invitado" },
                { v: "linked", l: "Con cuenta" },
              ].map((m) => (
                <TouchableOpacity
                  key={m.v}
                  style={[styles.toggle, mode === m.v && styles.toggleActive]}
                  onPress={() => setMode(m.v)}
                >
                  <Text style={[styles.toggleText, mode === m.v && styles.toggleTextActive]}>{m.l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Nombre</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={mode === "guest" ? "Nombre del invitado" : "Alias opcional"}
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
            />

            {mode === "linked" && (
              <>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </>
            )}

            <Text style={styles.label}>Alcance del reparto</Text>
            <View style={styles.row}>
              {[
                { v: "future", l: "Desde ahora" },
                { v: "all", l: "Recalcular historial" },
              ].map((h) => (
                <TouchableOpacity
                  key={h.v}
                  style={[styles.toggle, historyMode === h.v && styles.toggleActive]}
                  onPress={() => setHistoryMode(h.v)}
                >
                  <Text style={[styles.toggleText, historyMode === h.v && styles.toggleTextActive]}>
                    {h.l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>
              "Desde ahora" solo lo suma a gastos futuros. "Recalcular historial" lo incluye en todos los gastos del grupo.
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Agregar miembro</Text>}
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
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
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
  hint: { color: colors.muted, fontSize: 12, marginTop: 10, lineHeight: 17 },
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
