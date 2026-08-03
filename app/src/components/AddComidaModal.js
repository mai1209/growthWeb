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
// Permite decimales con coma o punto (para "0,5 pote").
const soloDec = (v) => v.replace(/[^0-9.,]/g, "").replace(",", ".").replace(/(\..*)\./g, "$1");

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

// Formatea la cantidad: 0.5 -> "0,5", 2 -> "2", 1.5 -> "1,5".
const fmtCant = (n) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ","));

export default function AddComidaModal({ visible, franja, onClose, onGuardar }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();

  const [nombre, setNombre] = useState("");
  const [kcal, setKcal] = useState("");
  const [carb, setCarb] = useState("");
  const [prot, setProt] = useState("");
  const [fat, setFat] = useState("");
  const [cant, setCant] = useState("1"); // cantidad (porciones o gramos según modo; admite decimales)
  const [unidad, setUnidad] = useState(""); // porción (pote, puñado, cucharada…)
  const [gramos, setGramos] = useState(0); // gramos que pesa 1 porción (0 = desconocido)
  const [modo, setModo] = useState("porcion"); // "porcion" | "g"
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
      setCant("1");
      setUnidad("");
      setGramos(0);
      setModo("porcion");
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
      (b) =>
        (norm(b.nombre).includes(q) || (b.alias && norm(b.alias).includes(q))) &&
        !delHistorial.some((h) => norm(h.nombre) === norm(b.nombre))
    );
    return [...delHistorial, ...deLaBase].slice(0, 8);
  }, [nombre, historial, elegida]);

  const usarSugerencia = (s) => {
    setNombre(s.nombre);
    setKcal(String(s.kcal || ""));
    setCarb(String(s.carbG || ""));
    setProt(String(s.protG || ""));
    setFat(String(s.fatG || ""));
    setUnidad(s.unidad || "");
    setGramos(Number(s.gramos) || 0);
    setModo("porcion");
    setCant("1");
    setElegida(true);
  };

  const cambiarModo = (m) => {
    if (m === modo) return;
    setModo(m);
    setCant(m === "g" ? String(gramos || 100) : "1");
  };

  const cantNum = parseFloat(String(cant).replace(",", ".")) || 0;
  // En modo gramos, factor = gramos consumidos / gramos por porción.
  const factor = modo === "g" && gramos > 0 ? cantNum / gramos : cantNum || 1;
  const kcalUnit = parseInt(kcal, 10) || 0;
  const totalKcal = Math.round(kcalUnit * factor);
  const kcal100 = gramos > 0 ? Math.round((kcalUnit / gramos) * 100) : 0;

  const guardar = () => {
    if (!nombre.trim() || kcalUnit <= 0 || cantNum <= 0) return;
    const base = nombre.trim();
    let nombreFinal = base;
    if (modo === "g") nombreFinal = `${base} · ${fmtCant(cantNum)} g`;
    else if (unidad) nombreFinal = `${base} · ${fmtCant(cantNum)} ${unidad}`;
    else if (cantNum !== 1) nombreFinal = `${base} ×${fmtCant(cantNum)}`;
    onGuardar?.({
      franja: franja?.key,
      nombre: nombreFinal,
      kcal: totalKcal,
      carbG: Math.round((parseInt(carb, 10) || 0) * factor),
      protG: Math.round((parseInt(prot, 10) || 0) * factor),
      fatG: Math.round((parseInt(fat, 10) || 0) * factor),
    });
    onClose?.();
  };

  const puedeGuardar = nombre.trim() && kcalUnit > 0 && cantNum > 0;

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
                setUnidad("");
                setGramos(0);
                setModo("porcion");
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
                      {s.unidad ? (
                        <Text style={styles.sugUnidad}>
                          {" "}· {s.unidad}
                          {s.gramos ? ` ≈${s.gramos} g` : ""}
                        </Text>
                      ) : null}
                    </Text>
                    <Text style={styles.sugKcal}>{s.kcal} kcal</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <View style={styles.filaDoble}>
              <View style={styles.campoDoble}>
                <Text style={styles.label}>Calorías (por {unidad || "unidad"})</Text>
                <TextInput
                  style={styles.input}
                  value={kcal}
                  onChangeText={(v) => setKcal(soloNum(v))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                />
                {gramos > 0 ? (
                  <Text style={styles.kcal100Hint}>≈ {kcal100} kcal / 100 g</Text>
                ) : null}
              </View>
              <View style={styles.campoCant}>
                <Text style={styles.label}>Cantidad ({modo === "g" ? "g" : unidad || "u."})</Text>
                <View style={styles.cantRow}>
                  <TouchableOpacity
                    style={styles.cantBtn}
                    onPress={() => {
                      const paso = modo === "g" ? 10 : 0.5;
                      const min = modo === "g" ? 0 : 0.5;
                      setCant(fmtCant(Math.max(min, Math.round((cantNum - paso) / paso) * paso)));
                    }}
                  >
                    <Ionicons name="remove" size={18} color={colors.text} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.cantInput}
                    value={cant}
                    onChangeText={(v) => setCant(soloDec(v))}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor={colors.muted}
                  />
                  <TouchableOpacity
                    style={styles.cantBtn}
                    onPress={() => {
                      const paso = modo === "g" ? 10 : 0.5;
                      setCant(fmtCant(Math.round((cantNum + paso) / paso) * paso));
                    }}
                  >
                    <Ionicons name="add" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {gramos > 0 ? (
              <View style={styles.modoToggle}>
                <TouchableOpacity
                  style={[styles.modoBtn, modo === "porcion" && styles.modoBtnOn]}
                  onPress={() => cambiarModo("porcion")}
                >
                  <Text style={[styles.modoText, modo === "porcion" && styles.modoTextOn]}>
                    Por {unidad}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modoBtn, modo === "g" && styles.modoBtnOn]}
                  onPress={() => cambiarModo("g")}
                >
                  <Text style={[styles.modoText, modo === "g" && styles.modoTextOn]}>Gramos</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cantChips}>
                {["0.5", "1", "2", "3"].map((v) => (
                  <TouchableOpacity key={v} style={styles.cantChip} onPress={() => setCant(v)}>
                    <Text style={styles.cantChipText}>{v === "0.5" ? "½" : v}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {cantNum > 0 && kcalUnit > 0 && (modo === "g" || cantNum !== 1) ? (
              <Text style={styles.totalHint}>
                Total: {totalKcal} kcal
                {modo === "g"
                  ? ` · ${fmtCant(cantNum)} g${
                      gramos > 0 ? ` (≈ ${fmtCant(Math.round((cantNum / gramos) * 10) / 10)} ${unidad})` : ""
                    }`
                  : unidad
                  ? ` · ${fmtCant(cantNum)} ${unidad}`
                  : ""}
              </Text>
            ) : null}

            <Text style={styles.label}>Macros (opcional, en gramos — por unidad)</Text>
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
    filaDoble: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    campoDoble: { flex: 1 },
    campoCant: { width: 132 },
    cantRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    cantBtn: {
      width: 38,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
    },
    cantInput: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
      textAlign: "center",
    },
    totalHint: { color: colors.greenBright, fontSize: 13, fontWeight: "800", marginTop: 8 },
    kcal100Hint: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 4 },
    modoToggle: {
      flexDirection: "row",
      marginTop: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 999,
      overflow: "hidden",
      alignSelf: "flex-start",
    },
    modoBtn: { paddingHorizontal: 16, paddingVertical: 8 },
    modoBtnOn: { backgroundColor: colors.greenBright },
    modoText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
    modoTextOn: { color: "#06210a" },
    cantChips: { flexDirection: "row", gap: 8, marginTop: 10 },
    cantChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    cantChipText: { color: colors.text, fontSize: 14, fontWeight: "800" },
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
    sugUnidad: { color: colors.muted, fontWeight: "600" },
    sugKcal: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  });
