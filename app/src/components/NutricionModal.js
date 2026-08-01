import React, { useEffect, useMemo, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { calcularPlan, ACTIVIDADES, OBJETIVOS } from "../utils/nutricion";

const soloNum = (v) => v.replace(/[^0-9]/g, "");

export default function NutricionModal({ visible, onClose, onGuardar, initial, pesoSugerido }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [edad, setEdad] = useState("");
  const [sexo, setSexo] = useState("H");
  const [actividad, setActividad] = useState("ligero");
  const [objetivo, setObjetivo] = useState("mantener");

  useEffect(() => {
    if (!visible) return;
    setPeso(String(initial?.peso || pesoSugerido || ""));
    setAltura(String(initial?.altura || ""));
    setEdad(String(initial?.edad || ""));
    setSexo(initial?.sexo || "H");
    setActividad(initial?.actividad || "ligero");
    setObjetivo(initial?.objetivo || "mantener");
  }, [visible, initial, pesoSugerido]);

  const cfg = { peso, altura, edad, sexo, actividad, objetivo };
  const plan = useMemo(() => calcularPlan(cfg), [peso, altura, edad, sexo, actividad, objetivo]);

  const guardar = () => {
    if (!plan) return;
    onGuardar?.({
      peso: Number(peso),
      altura: Number(altura),
      edad: Number(edad),
      sexo,
      actividad,
      objetivo,
    });
    onClose?.();
  };

  const Seg = ({ opciones, valor, onChange }) => (
    <View style={styles.segRow}>
      {opciones.map((o) => {
        const activo = valor === o.key;
        return (
          <TouchableOpacity
            key={o.key}
            style={[styles.segBtn, activo && styles.segBtnOn]}
            onPress={() => onChange(o.key)}
          >
            <Text style={[styles.segText, activo && styles.segTextOn]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Tu plan</Text>
          <TouchableOpacity
            style={[styles.saveBtn, !plan && { opacity: 0.4 }]}
            onPress={guardar}
            disabled={!plan}
          >
            <Text style={styles.saveText}>Guardar</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.fila}>
              <View style={styles.campo}>
                <Text style={styles.label}>Peso (kg)</Text>
                <TextInput
                  style={styles.input}
                  value={peso}
                  onChangeText={(v) => setPeso(soloNum(v))}
                  keyboardType="number-pad"
                  placeholder="70"
                  placeholderTextColor={colors.muted}
                />
              </View>
              <View style={styles.campo}>
                <Text style={styles.label}>Altura (cm)</Text>
                <TextInput
                  style={styles.input}
                  value={altura}
                  onChangeText={(v) => setAltura(soloNum(v))}
                  keyboardType="number-pad"
                  placeholder="175"
                  placeholderTextColor={colors.muted}
                />
              </View>
              <View style={styles.campo}>
                <Text style={styles.label}>Edad</Text>
                <TextInput
                  style={styles.input}
                  value={edad}
                  onChangeText={(v) => setEdad(soloNum(v))}
                  keyboardType="number-pad"
                  placeholder="28"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>

            <Text style={styles.label}>Sexo</Text>
            <Seg
              opciones={[
                { key: "H", label: "Hombre" },
                { key: "M", label: "Mujer" },
              ]}
              valor={sexo}
              onChange={setSexo}
            />

            <Text style={styles.label}>Actividad</Text>
            <Seg opciones={ACTIVIDADES} valor={actividad} onChange={setActividad} />

            <Text style={styles.label}>Objetivo</Text>
            <Seg opciones={OBJETIVOS} valor={objetivo} onChange={setObjetivo} />

            <View style={styles.preview}>
              <Text style={styles.previewKicker}>TU NORMA DIARIA</Text>
              <Text style={styles.previewKcal}>
                {plan ? plan.kcal.toLocaleString("es-AR") : "—"} <Text style={styles.previewKcalU}>kcal</Text>
              </Text>
              {plan ? (
                <View style={styles.previewMacros}>
                  <Text style={styles.previewMacro}>
                    <Text style={styles.previewMacroN}>{plan.carbG}g</Text> carbos
                  </Text>
                  <Text style={styles.previewMacro}>
                    <Text style={styles.previewMacroN}>{plan.protG}g</Text> proteína
                  </Text>
                  <Text style={styles.previewMacro}>
                    <Text style={styles.previewMacroN}>{plan.fatG}g</Text> grasa
                  </Text>
                </View>
              ) : (
                <Text style={styles.previewHint}>Completá peso, altura y edad.</Text>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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

    scroll: { padding: 16, gap: 12, paddingBottom: 40 },
    fila: { flexDirection: "row", gap: 10 },
    campo: { flex: 1 },
    label: { color: colors.muted, fontSize: 13, fontWeight: "700", marginBottom: 6 },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 17,
      fontWeight: "800",
      textAlign: "center",
    },

    segRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    segBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    segBtnOn: { backgroundColor: colors.greenBright, borderColor: colors.greenBright },
    segText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
    segTextOn: { color: "#06210a", fontWeight: "800" },

    preview: {
      marginTop: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 16,
      padding: 18,
      alignItems: "center",
      gap: 4,
    },
    previewKicker: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
    previewKcal: { color: colors.text, fontSize: 40, fontWeight: "900" },
    previewKcalU: { color: colors.muted, fontSize: 18, fontWeight: "700" },
    previewMacros: { flexDirection: "row", gap: 14, marginTop: 4 },
    previewMacro: { color: colors.muted, fontSize: 13 },
    previewMacroN: { color: colors.text, fontWeight: "800" },
    previewHint: { color: colors.muted, fontSize: 13 },
  });
