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
import { createGuestAlias } from "../utils/shared";

export default function CreateGroupModal({ visible, onClose, onCreated }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("ARS");
  const [mode, setMode] = useState("guest"); // guest | linked
  const [input, setInput] = useState("");
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName("");
      setCurrency("ARS");
      setMode("guest");
      setInput("");
      setParticipants([]);
      setError("");
      setSaving(false);
    }
  }, [visible]);

  const addParticipant = () => {
    const value = input.trim();
    if (!value) return;
    if (mode === "linked" && !value.includes("@")) {
      setError("Para vincular una cuenta, cargá un email.");
      return;
    }
    const email = mode === "guest" ? createGuestAlias(value) : value.toLowerCase();
    const username = mode === "guest" ? value : value.split("@")[0];
    if (participants.some((p) => p.email === email)) {
      setError("Ese participante ya está cargado.");
      return;
    }
    setParticipants((prev) => [...prev, { email, username, isGuest: mode === "guest" }]);
    setInput("");
    setError("");
  };

  const removeParticipant = (email) =>
    setParticipants((prev) => prev.filter((p) => p.email !== email));

  const handleCreate = async () => {
    setError("");
    if (!name.trim()) {
      setError("Ponele un nombre al grupo.");
      return;
    }
    if (participants.length === 0) {
      setError("Agregá al menos un participante.");
      return;
    }
    setSaving(true);
    try {
      await sharedGroupsService.create({
        name: name.trim(),
        currency,
        participants: participants.map((p) => ({
          email: p.email,
          username: p.username,
          isGuest: p.isGuest,
        })),
        splitMode: "equal",
        splitConfig: participants.map((p) => ({
          participantEmail: p.email,
          percentage: null,
          amount: null,
        })),
      });
      onCreated?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo crear el grupo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Nuevo grupo</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Nombre del grupo</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ej: Viaje, Depto, Socios"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Moneda</Text>
            <View style={styles.row}>
              {["ARS", "USD"].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.toggle, currency === c && styles.toggleActive]}
                  onPress={() => setCurrency(c)}
                >
                  <Text style={[styles.toggleText, currency === c && styles.toggleTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Participantes</Text>
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
            <View style={styles.addRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={input}
                onChangeText={setInput}
                placeholder={mode === "guest" ? "Nombre del invitado" : "correo@ejemplo.com"}
                placeholderTextColor={colors.muted}
                autoCapitalize={mode === "linked" ? "none" : "words"}
                keyboardType={mode === "linked" ? "email-address" : "default"}
                onSubmitEditing={addParticipant}
              />
              <TouchableOpacity style={styles.addBtn} onPress={addParticipant}>
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {participants.map((p) => (
              <View key={p.email} style={styles.partRow}>
                <Ionicons
                  name={p.isGuest ? "person-outline" : "at-outline"}
                  size={16}
                  color={colors.greenDark}
                />
                <Text style={styles.partName}>{p.username}</Text>
                <TouchableOpacity onPress={() => removeParticipant(p.email)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={colors.muted} />
                </TouchableOpacity>
              </View>
            ))}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Crear grupo</Text>}
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
  addRow: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8 },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.greenBright,
    alignItems: "center",
    justifyContent: "center",
  },
  partRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
  },
  partName: { flex: 1, color: colors.text, fontWeight: "600" },
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
