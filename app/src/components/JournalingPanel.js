import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { journalService } from "../api";
import { useTheme } from "../theme";

// Ánimo del día: 1 (muy mal) a 5 (muy bien).
const ANIMOS = [
  { valor: 1, emoji: "😞" },
  { valor: 2, emoji: "😕" },
  { valor: 3, emoji: "😐" },
  { valor: 4, emoji: "🙂" },
  { valor: 5, emoji: "😄" },
];

// Preguntas guiadas estilo "5 minute journal". El texto es personalizable.
const PREGUNTAS_DEFAULT = {
  gratitud: "Hoy agradezco…",
  mejor: "Lo mejor de hoy fue…",
  distinto: "¿Qué harías distinto?",
};
const CAMPOS = [
  { campo: "gratitud", placeholder: "Una cosa alcanza." },
  { campo: "mejor", placeholder: "Un momento, una persona, un logro." },
  { campo: "distinto", placeholder: "Sin culpa: es para mañana." },
];

// Color de cada nivel de ánimo (rojo → verde) para el gráfico.
const ANIMO_COLORS = { 1: "#e5484d", 2: "#e58a3a", 3: "#c9a23a", 4: "#8fbf3f", 5: "#14d95f" };

const ENTRADA_VACIA = { animo: 0, gratitud: "", mejor: "", distinto: "", libre: "" };

const hoyLocal = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const fechaLarga = (fecha) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const emojiDe = (animo) => ANIMOS.find((a) => a.valor === Number(animo))?.emoji || "·";

export default function JournalingPanel({ visible, onClose }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);

  const [fecha, setFecha] = useState(hoyLocal);
  const [entrada, setEntrada] = useState(ENTRADA_VACIA);
  const [historial, setHistorial] = useState([]);
  const [racha, setRacha] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const [focoCampo, setFocoCampo] = useState(null);
  const [preguntas, setPreguntas] = useState(PREGUNTAS_DEFAULT);
  const [editandoPreguntas, setEditandoPreguntas] = useState(false);
  const [borradorPreguntas, setBorradorPreguntas] = useState(PREGUNTAS_DEFAULT);
  const guardadoRef = useRef(null);

  const aplicar = useCallback((data) => {
    setEntrada(data?.hoy ? { ...ENTRADA_VACIA, ...data.hoy } : ENTRADA_VACIA);
    setHistorial(Array.isArray(data?.entradas) ? data.entradas : []);
    setRacha(Number(data?.racha) || 0);
    if (data?.preguntas) setPreguntas({ ...PREGUNTAS_DEFAULT, ...data.preguntas });
  }, []);

  useEffect(() => {
    if (!visible) return;
    const actual = hoyLocal();
    setFecha(actual);
    setCargando(true);
    journalService
      .get(actual)
      .then(({ data }) => aplicar(data))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [visible, aplicar]);

  // Autoguardado, igual que Afirmaciones.
  const guardarDiferido = useCallback(
    (proxima) => {
      if (guardadoRef.current) clearTimeout(guardadoRef.current);
      guardadoRef.current = setTimeout(async () => {
        setGuardando(true);
        try {
          const { data } = await journalService.save({ ...proxima, fecha });
          setHistorial(Array.isArray(data?.entradas) ? data.entradas : []);
          setRacha(Number(data?.racha) || 0);
        } catch {
          /* reintenta en la próxima edición */
        } finally {
          setGuardando(false);
        }
      }, 800);
    },
    [fecha]
  );

  useEffect(() => () => guardadoRef.current && clearTimeout(guardadoRef.current), []);

  const editar = (campo, valor) => {
    setEntrada((prev) => {
      const proxima = { ...prev, [campo]: valor };
      guardarDiferido(proxima);
      return proxima;
    });
  };

  const elegirAnimo = (valor) => {
    editar("animo", Number(entrada.animo) === valor ? 0 : valor);
  };

  const guardarPreguntas = async () => {
    setEditandoPreguntas(false);
    try {
      const { data } = await journalService.savePreguntas(borradorPreguntas);
      if (data?.preguntas) setPreguntas({ ...PREGUNTAS_DEFAULT, ...data.preguntas });
    } catch {
      /* quedan las anteriores */
    }
  };

  // Ánimo en el tiempo: historial (viejo → nuevo) + la entrada de hoy.
  const animoSerie = [...historial]
    .reverse()
    .concat(Number(entrada.animo) > 0 ? [{ fecha, animo: entrada.animo }] : [])
    .filter((e) => Number(e.animo) > 0)
    .slice(-30);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        {/* Encabezado */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>JOURNALING</Text>
            <Text style={styles.title}>Tu journal</Text>
          </View>
          {racha > 0 ? (
            <View style={styles.rachaPill}>
              <Text style={styles.rachaText}>🔥 {racha}</Text>
            </View>
          ) : null}
        </View>

        {cargando ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.green} />
          </View>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
          >
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
              {/* Fecha centrada, como en Afirmaciones */}
              <View style={styles.fechaRow}>
                <Ionicons name="create" size={19} color={colors.greenBright} />
                <Text style={styles.fecha}>{fechaLarga(fecha)}</Text>
              </View>

              {/* Ánimo */}
              <View style={styles.animoBox}>
                <Text style={styles.animoLabel}>¿CÓMO ESTUVO TU DÍA?</Text>
                <View style={styles.animoRow}>
                  {ANIMOS.map((a) => {
                    const activo = Number(entrada.animo) === a.valor;
                    return (
                      <TouchableOpacity
                        key={a.valor}
                        style={[styles.animoBtn, activo && styles.animoActivo]}
                        onPress={() => elegirAnimo(a.valor)}
                        accessibilityLabel={`Ánimo ${a.valor} de 5`}
                      >
                        <Text style={[styles.animoEmoji, !activo && styles.animoEmojiApagado]}>
                          {a.emoji}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Personalizar preguntas */}
              <View style={styles.preguntasHead}>
                {editandoPreguntas ? (
                  <>
                    <TouchableOpacity style={styles.preguntasBtn} onPress={guardarPreguntas}>
                      <Ionicons name="checkmark" size={14} color={colors.green} />
                      <Text style={styles.preguntasBtnText}>Guardar preguntas</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.preguntasBtn}
                      onPress={() => setEditandoPreguntas(false)}
                    >
                      <Ionicons name="close" size={14} color={colors.muted} />
                      <Text style={styles.preguntasBtnText}>Cancelar</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.preguntasBtn}
                    onPress={() => {
                      setBorradorPreguntas(preguntas);
                      setEditandoPreguntas(true);
                    }}
                  >
                    <Ionicons name="pencil" size={13} color={colors.muted} />
                    <Text style={styles.preguntasBtnText}>Personalizar preguntas</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Preguntas guiadas */}
              {CAMPOS.map((p) => (
                <View key={p.campo}>
                  {editandoPreguntas ? (
                    <TextInput
                      style={styles.preguntaInput}
                      value={borradorPreguntas[p.campo]}
                      onChangeText={(v) =>
                        setBorradorPreguntas((prev) => ({ ...prev, [p.campo]: v }))
                      }
                      placeholder={PREGUNTAS_DEFAULT[p.campo]}
                      placeholderTextColor={colors.muted}
                      maxLength={90}
                    />
                  ) : (
                    <Text style={styles.campoLabel}>{preguntas[p.campo]}</Text>
                  )}
                  <TextInput
                    style={[styles.input, focoCampo === p.campo && styles.inputFoco]}
                    value={entrada[p.campo]}
                    onChangeText={(v) => editar(p.campo, v)}
                    onFocus={() => setFocoCampo(p.campo)}
                    onBlur={() => setFocoCampo((prev) => (prev === p.campo ? null : prev))}
                    placeholder={p.placeholder}
                    placeholderTextColor={colors.muted}
                    multiline
                    editable={!editandoPreguntas}
                  />
                </View>
              ))}

              <View>
                <Text style={styles.campoLabel}>Notas libres (opcional)</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.inputLibre,
                    focoCampo === "libre" && styles.inputFoco,
                  ]}
                  value={entrada.libre}
                  onChangeText={(v) => editar("libre", v)}
                  onFocus={() => setFocoCampo("libre")}
                  onBlur={() => setFocoCampo((prev) => (prev === "libre" ? null : prev))}
                  placeholder="Lo que quieras dejar escrito de hoy…"
                  placeholderTextColor={colors.muted}
                  multiline
                />
              </View>

              {guardando ? <Text style={styles.guardandoText}>Guardando…</Text> : null}

              {/* Ánimo en el tiempo */}
              {animoSerie.length >= 3 ? (
                <View style={styles.animoChartBox}>
                  <Text style={styles.historialTitulo}>TU ÁNIMO EN EL TIEMPO</Text>
                  <View style={styles.chartBars}>
                    {animoSerie.map((e) => (
                      <View
                        key={e.fecha}
                        style={[
                          styles.chartBar,
                          {
                            height: `${(Number(e.animo) / 5) * 100}%`,
                            backgroundColor: ANIMO_COLORS[Number(e.animo)] || colors.greenBright,
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <View style={styles.chartLeyenda}>
                    <Text style={styles.chartLeyendaText}>{fechaLarga(animoSerie[0].fecha)}</Text>
                    <Text style={styles.chartLeyendaText}>hoy</Text>
                  </View>
                </View>
              ) : null}

              {/* Historial */}
              {historial.length > 0 ? (
                <View style={styles.historial}>
                  <Text style={styles.historialTitulo}>ENTRADAS ANTERIORES</Text>
                  {historial.map((e) => {
                    const abiertaEsta = abierta === e.fecha;
                    return (
                      <View key={e.fecha} style={styles.entrada}>
                        <TouchableOpacity
                          style={styles.entradaHead}
                          onPress={() => setAbierta(abiertaEsta ? null : e.fecha)}
                        >
                          <Text style={styles.entradaEmoji}>{emojiDe(e.animo)}</Text>
                          <Text style={styles.entradaFecha}>{fechaLarga(e.fecha)}</Text>
                          <Ionicons
                            name={abiertaEsta ? "chevron-up" : "chevron-down"}
                            size={16}
                            color={colors.muted}
                          />
                        </TouchableOpacity>
                        {abiertaEsta ? (
                          <View style={styles.entradaBody}>
                            {CAMPOS.map((p) =>
                              e[p.campo] ? (
                                <View key={p.campo} style={styles.entradaCampo}>
                                  <Text style={styles.entradaCampoLabel}>{preguntas[p.campo]}</Text>
                                  <Text style={styles.entradaCampoTexto}>{e[p.campo]}</Text>
                                </View>
                              ) : null
                            )}
                            {e.libre ? (
                              <View style={styles.entradaCampo}>
                                <Text style={styles.entradaCampoLabel}>Notas libres</Text>
                                <Text style={styles.entradaCampoTexto}>{e.libre}</Text>
                              </View>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    loading: { flex: 1, alignItems: "center", justifyContent: "center" },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 10,
    },
    backBtn: { padding: 4 },
    kicker: { color: colors.greenDark, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
    title: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 2 },
    rachaPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.greenBorder,
      backgroundColor: colors.greenSoft,
    },
    rachaText: { color: colors.green, fontSize: 13, fontWeight: "800" },

    scroll: { paddingHorizontal: 16, paddingBottom: 30, gap: 12 },

    fechaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 6,
    },
    fecha: { color: colors.text, fontSize: 16, fontWeight: "800", textTransform: "capitalize" },

    animoBox: {
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      gap: 10,
    },
    animoLabel: { color: colors.muted, fontSize: 10.5, fontWeight: "800", letterSpacing: 1 },
    animoRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
    animoBtn: {
      flex: 1,
      height: 46,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: "transparent",
      backgroundColor: colors.cardSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    animoActivo: { borderColor: colors.greenBright },
    animoEmoji: { fontSize: 22 },
    animoEmojiApagado: { opacity: 0.45 },

    campoLabel: {
      color: colors.green,
      fontSize: 13,
      fontWeight: "800",
      marginBottom: 5,
    },
    input: {
      minHeight: 46,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      color: colors.text,
      fontSize: 15,
      lineHeight: 20,
    },
    inputLibre: { minHeight: 90, textAlignVertical: "top" },
    // Campo enfocado: borde verde brillante, como en Afirmaciones
    inputFoco: { borderColor: colors.greenBright, borderWidth: 1.5 },

    guardandoText: { color: colors.muted, fontSize: 12 },

    preguntasHead: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
    preguntasBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.cardBorder,
    },
    preguntasBtnText: { color: colors.muted, fontSize: 11.5, fontWeight: "700" },
    preguntaInput: {
      minHeight: 38,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 5,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.greenBorder,
      backgroundColor: colors.card,
      color: colors.green,
      fontSize: 13,
      fontWeight: "800",
    },

    animoChartBox: {
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      gap: 8,
    },
    chartBars: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 3,
      height: 64,
    },
    chartBar: { flex: 1, maxWidth: 22, borderRadius: 3 },
    chartLeyenda: { flexDirection: "row", justifyContent: "space-between" },
    chartLeyendaText: {
      color: colors.muted,
      fontSize: 10.5,
      fontWeight: "600",
      textTransform: "capitalize",
    },

    historial: {
      marginTop: 6,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
      gap: 8,
    },
    historialTitulo: {
      color: colors.muted,
      fontSize: 10.5,
      fontWeight: "800",
      letterSpacing: 1.2,
      marginBottom: 2,
    },
    entrada: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      overflow: "hidden",
    },
    entradaHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    entradaEmoji: { width: 24, textAlign: "center", fontSize: 16 },
    entradaFecha: {
      flex: 1,
      color: colors.text,
      fontSize: 13.5,
      fontWeight: "700",
      textTransform: "capitalize",
    },
    entradaBody: { paddingHorizontal: 12, paddingBottom: 12, gap: 9 },
    entradaCampo: { gap: 2 },
    entradaCampoLabel: { color: colors.green, fontSize: 11.5, fontWeight: "800" },
    entradaCampoTexto: { color: colors.text, fontSize: 13.5, lineHeight: 19 },
  });
