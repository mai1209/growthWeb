import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";

const soloNum = (v) => v.replace(/[^0-9]/g, "");

export default function AddComidaModal({ visible, franja, onClose, onGuardar }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();

  const [nombre, setNombre] = useState("");
  const [kcal, setKcal] = useState("");
  const [carb, setCarb] = useState("");
  const [prot, setProt] = useState("");
  const [fat, setFat] = useState("");

  useEffect(() => {
    if (visible) {
      setNombre("");
      setKcal("");
      setCarb("");
      setProt("");
      setFat("");
    }
  }, [visible]);

  const guardar = () => {
    const k = parseInt(kcal, 10) || 0;
    if (!nombre.trim() || k <= 0) return;
    onGuardar?.({
      franja: franja?.key,
      nombre: nombre.trim(),
      kcal: k,
      carbG: parseInt(carb, 10) || 0,
      protG: parseInt(prot, 10) || 0,
      fatG: parseInt(fat, 10) || 0,
    });
    onClose?.();
  };

  const puedeGuardar = nombre.trim() && (parseInt(kcal, 10) || 0) > 0;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{franja?.label || "Comida"}</Text>
          <TouchableOpacity
            style={[styles.saveBtn, !puedeGuardar && { opacity: 0.4 }]}
            onPress={guardar}
            disabled={!puedeGuardar}
          >
            <Text style={styles.saveText}>Agregar</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>¿Qué comiste?</Text>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              placeholder="Ej: Milanesa con puré"
              placeholderTextColor={colors.muted}
              autoFocus
            />

            <Text style={styles.label}>Calorías</Text>
            <TextInput
              style={styles.input}
              value={kcal}
              onChangeText={(v) => setKcal(soloNum(v))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Macros (opcional, en gramos)</Text>
            <View style={styles.macrosRow}>
              <View style={styles.macroCampo}>
                <Text style={styles.macroLabel}>Carbos</Text>
                <TextInput
                  style={styles.macroInput}
                  value={carb}
                  onChangeText={(v) => setCarb(soloNum(v))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                />
              </View>
              <View style={styles.macroCampo}>
                <Text style={styles.macroLabel}>Proteína</Text>
                <TextInput
                  style={styles.macroInput}
                  value={prot}
                  onChangeText={(v) => setProt(soloNum(v))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                />
              </View>
              <View style={styles.macroCampo}>
                <Text style={styles.macroLabel}>Grasa</Text>
                <TextInput
                  style={styles.macroInput}
                  value={fat}
                  onChangeText={(v) => setFat(soloNum(v))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>

            <Text style={styles.hint}>
              Más adelante vas a poder sacar una foto o mandar un audio y que se complete solo.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    title: { color: colors.text, fontSize: 18, fontWeight: "800" },
    saveBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.greenBright,
    },
    saveText: { color: "#06210a", fontSize: 14, fontWeight: "800" },

    scroll: { padding: 16, gap: 8, paddingBottom: 40 },
    label: { color: colors.muted, fontSize: 13, fontWeight: "700", marginTop: 8, marginBottom: 2 },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    macrosRow: { flexDirection: "row", gap: 10 },
    macroCampo: { flex: 1 },
    macroLabel: { color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 4 },
    macroInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 11,
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
      textAlign: "center",
    },
    hint: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 14 },
  });
