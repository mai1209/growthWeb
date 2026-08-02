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
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { useTheme } from "../theme";
import { nutricionService } from "../api";
import { tomarFotoComida, elegirFotoComida } from "../utils/foto";
import { BASE_COMIDAS } from "../utils/comidasBase";

const soloNum = (v) => v.replace(/[^0-9]/g, "");

// Análisis por foto (IA): requiere créditos de Anthropic. Lo dejamos apagado
// por ahora; poner en true cuando la API key esté cargada en el backend.
const IA_FOTO_HABILITADA = false;

// Mismo storage que usa SaludScreen para las comidas del día.
const COMIDAS_KEY = "salud_comidas_v1";

// Normaliza para comparar nombres ("Milanesa " ≈ "milanesa").
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export default function AddComidaModal({ visible, franja, onClose, onGuardar }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();

  const [nombre, setNombre] = useState("");
  const [kcal, setKcal] = useState("");
  const [carb, setCarb] = useState("");
  const [prot, setProt] = useState("");
  const [fat, setFat] = useState("");
  const [analizando, setAnalizando] = useState(false);

  const correrAnalisis = async (getter) => {
    const foto = await getter();
    if (!foto?.base64) return;
    setAnalizando(true);
    try {
      const { data } = await nutricionService.analizarFoto(foto.base64, foto.mediaType);
      if (data?.nombre) setNombre(data.nombre);
      if (data?.kcal) setKcal(String(data.kcal));
      if (data?.carbG != null) setCarb(String(data.carbG));
      if (data?.protG != null) setProt(String(data.protG));
      if (data?.fatG != null) setFat(String(data.fatG));
      if (!data?.nombre && !data?.kcal) {
        Alert.alert("Sin resultado", "No pude reconocer una comida en la foto. Probá con otra.");
      }
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || "No se pudo analizar la foto.");
    } finally {
      setAnalizando(false);
    }
  };

  const analizarConFoto = () => {
    Alert.alert("Analizar comida con foto", "¿De dónde sacamos la foto?", [
      { text: "Cámara", onPress: () => correrAnalisis(tomarFotoComida) },
      { text: "Galería", onPress: () => correrAnalisis(elegirFotoComida) },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  useEffect(() => {
    if (visible) {
      setNombre("");
      setKcal("");
      setCarb("");
      setProt("");
      setFat("");
      setElegida(false);
    }
  }, [visible]);

  // ---- Autocompletado: tu historial (promedio de registros previos) + base local ----
  const [historial, setHistorial] = useState([]);
  const [elegida, setElegida] = useState(false); // ya eligió una sugerencia → ocultar lista

  useEffect(() => {
    if (!visible) return;
    SecureStore.getItemAsync(COMIDAS_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const dias = JSON.parse(raw)?.dias || {};
          const map = new Map();
          Object.keys(dias)
            .sort()
            .forEach((dia) => {
              (dias[dia] || []).forEach((c) => {
                const key = norm(c.nombre);
                if (!key) return;
                const e = map.get(key) || { nombre: c.nombre, n: 0, kcal: 0, carbG: 0, protG: 0, fatG: 0 };
                e.nombre = c.nombre; // se queda con la escritura más reciente
                e.n += 1;
                e.kcal += c.kcal || 0;
                e.carbG += c.carbG || 0;
                e.protG += c.protG || 0;
                e.fatG += c.fatG || 0;
                map.set(key, e);
              });
            });
          setHistorial(
            [...map.values()].map((e) => ({
              nombre: e.nombre,
              kcal: Math.round(e.kcal / e.n),
              carbG: Math.round(e.carbG / e.n),
              protG: Math.round(e.protG / e.n),
              fatG: Math.round(e.fatG / e.n),
              propia: true,
            }))
          );
        } catch {}
      })
      .catch(() => {});
  }, [visible]);

  const sugerencias = useMemo(() => {
    const q = norm(nombre);
    if (elegida || q.length < 2) return [];
    const delHistorial = historial.filter((h) => norm(h.nombre).includes(q));
    const deLaBase = BASE_COMIDAS.filter(
      (b) => norm(b.nombre).includes(q) && !delHistorial.some((h) => norm(h.nombre) === norm(b.nombre))
    );
    return [...delHistorial, ...deLaBase].slice(0, 5);
  }, [nombre, historial, elegida]);

  const usarSugerencia = (s) => {
    setNombre(s.nombre);
    setKcal(String(s.kcal || ""));
    setCarb(String(s.carbG || ""));
    setProt(String(s.protG || ""));
    setFat(String(s.fatG || ""));
    setElegida(true);
  };

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
            {IA_FOTO_HABILITADA ? (
              <TouchableOpacity
                style={[styles.iaBtn, analizando && { opacity: 0.7 }]}
                onPress={analizarConFoto}
                disabled={analizando}
              >
                {analizando ? (
                  <ActivityIndicator color="#06210a" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color="#06210a" />
                    <Text style={styles.iaBtnText}>Analizar con foto (IA)</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}

            <Text style={styles.label}>¿Qué comiste?</Text>
            <TextInput
              style={styles.input}
              value={nombre}
              onChangeText={(v) => {
                setNombre(v);
                setElegida(false);
              }}
              placeholder="Ej: Milanesa con puré"
              placeholderTextColor={colors.muted}
              autoFocus
            />

            {sugerencias.length > 0 ? (
              <View style={styles.sugList}>
                {sugerencias.map((s, i) => (
                  <TouchableOpacity
                    key={`${s.nombre}-${i}`}
                    style={[styles.sugRow, i > 0 && styles.sugRowBorder]}
                    onPress={() => usarSugerencia(s)}
                  >
                    <Ionicons
                      name={s.propia ? "time-outline" : "restaurant-outline"}
                      size={14}
                      color={s.propia ? colors.greenDark : colors.muted}
                    />
                    <Text style={styles.sugNombre} numberOfLines={1}>
                      {s.nombre}
                    </Text>
                    <Text style={styles.sugKcal}>{s.kcal} kcal</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

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
    iaBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: colors.greenBright,
      marginBottom: 4,
    },
    iaBtnText: { color: "#06210a", fontSize: 14, fontWeight: "800" },

    sugList: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      marginTop: 6,
      overflow: "hidden",
    },
    sugRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    sugRowBorder: { borderTopWidth: 1, borderTopColor: colors.cardBorder },
    sugNombre: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
    sugKcal: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  });
