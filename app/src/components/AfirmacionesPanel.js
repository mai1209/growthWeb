import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { afirmacionService } from "../api";
import { useTheme } from "../theme";

const RENGLONES_INICIALES = 5;
const MAX_RENGLONES = 30;

// Fecha local del teléfono en formato YYYY-MM-DD. No usamos toISOString() a
// secas porque devuelve UTC y a la noche cambia el día antes de tiempo.
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

export default function AfirmacionesPanel({ visible, onClose }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors);

  const [fecha, setFecha] = useState(hoyLocal);
  const [lineas, setLineas] = useState(() => Array(RENGLONES_INICIALES).fill(""));
  const [leidoHoy, setLeidoHoy] = useState(false);
  const [racha, setRacha] = useState(0);
  const [repetirDiario, setRepetirDiario] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const guardadoRef = useRef(null);

  const aplicarRespuesta = useCallback((data) => {
    const recibidas = Array.isArray(data?.lineas) ? data.lineas : [];
    const completas =
      recibidas.length >= RENGLONES_INICIALES
        ? recibidas
        : [...recibidas, ...Array(RENGLONES_INICIALES - recibidas.length).fill("")];
    setLineas(completas);
    setLeidoHoy(Boolean(data?.leidoHoy));
    setRacha(Number(data?.racha) || 0);
    setRepetirDiario(data?.repetirDiario !== false);
  }, []);

  const cargar = useCallback(
    async (fechaObjetivo) => {
      try {
        const { data } = await afirmacionService.get(fechaObjetivo);
        aplicarRespuesta(data);
      } catch {
        /* si falla dejamos lo que haya en pantalla */
      } finally {
        setCargando(false);
      }
    },
    [aplicarRespuesta]
  );

  // Al abrir el panel refrescamos el día: si pasó la medianoche, cambia la fecha
  // de arriba y el botón vuelve a estar disponible.
  useEffect(() => {
    if (!visible) return;
    const actual = hoyLocal();
    setFecha(actual);
    setCargando(true);
    cargar(actual);
  }, [visible, cargar]);

  // Autoguardado: no hay botón de guardar, se persiste al dejar de tipear.
  const guardarDiferido = useCallback(
    (proximas) => {
      if (guardadoRef.current) clearTimeout(guardadoRef.current);
      guardadoRef.current = setTimeout(async () => {
        setGuardando(true);
        try {
          await afirmacionService.save({ lineas: proximas, fecha });
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

  const editarLinea = (indice, valor) => {
    setLineas((prev) => {
      const proximas = prev.map((linea, i) => (i === indice ? valor : linea));
      guardarDiferido(proximas);
      return proximas;
    });
  };

  const agregarLinea = () => {
    setLineas((prev) => {
      if (prev.length >= MAX_RENGLONES) return prev;
      const proximas = [...prev, ""];
      guardarDiferido(proximas);
      return proximas;
    });
  };

  const borrarLinea = (indice) => {
    setLineas((prev) => {
      if (prev.length <= 1) return prev;
      const proximas = prev.filter((_, i) => i !== indice);
      guardarDiferido(proximas);
      return proximas;
    });
  };

  const hayEscritas = useMemo(() => lineas.some((l) => l.trim()), [lineas]);

  const alternarRepetir = () => {
    const proximo = !repetirDiario;
    setRepetirDiario(proximo); // optimista
    afirmacionService.save({ repetirDiario: proximo, fecha }).catch(() => {
      setRepetirDiario(!proximo); // si falló, volvemos al estado real
    });
  };

  const alternarLeido = async () => {
    const previo = leidoHoy;
    setLeidoHoy(!previo); // optimista: responde al toque al instante
    try {
      const { data } = previo
        ? await afirmacionService.desmarcarLeido(fecha)
        : await afirmacionService.marcarLeido(fecha);
      setLeidoHoy(Boolean(data?.leidoHoy));
      setRacha(Number(data?.racha) || 0);
    } catch {
      setLeidoHoy(previo); // si falló, volvemos al estado real
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top }]}>
        {/* Encabezado */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} accessibilityLabel="Volver">
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>AFIRMACIONES</Text>
            <Text style={styles.title}>Afirmaciones diarias</Text>
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
            keyboardVerticalOffset={insets.top + 8}
          >
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
            >
              {/* El día de hoy */}
              <View style={styles.fechaCard}>
                <Ionicons name="sunny-outline" size={17} color={colors.green} />
                <Text style={styles.fecha}>{fechaLarga(fecha)}</Text>
              </View>

              {/* Guardarlas al día siguiente */}
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitulo}>Guardarlas al día siguiente</Text>
                  <Text style={styles.switchDetalle}>
                    {repetirDiario
                      ? "Mañana vas a encontrar estas mismas afirmaciones."
                      : "Mañana vas a empezar con los renglones vacíos."}
                  </Text>
                </View>
                <Switch
                  value={repetirDiario}
                  onValueChange={alternarRepetir}
                  trackColor={{ false: colors.cardBorder, true: colors.greenSoft }}
                  thumbColor={repetirDiario ? colors.greenBright : colors.muted}
                />
              </View>

              <Text style={styles.ayuda}>
                {repetirDiario
                  ? "Escribí tus afirmaciones y leelas todos los días: podés editarlas cuando quieras."
                  : "Lo que escribas hoy se guarda igual, no se pierde."}
              </Text>

              {/* Renglones */}
              {lineas.map((linea, indice) => (
                <View key={indice} style={styles.item}>
                  <View style={styles.numero}>
                    <Text style={styles.numeroText}>{indice + 1}</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={linea}
                    onChangeText={(valor) => editarLinea(indice, valor)}
                    placeholder="Escribí tu afirmación…"
                    placeholderTextColor={colors.muted}
                    multiline
                  />
                  {lineas.length > 1 ? (
                    <TouchableOpacity
                      style={styles.borrar}
                      onPress={() => borrarLinea(indice)}
                      accessibilityLabel={`Borrar renglón ${indice + 1}`}
                    >
                      <Ionicons name="trash-outline" size={17} color={colors.muted} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}

              <View style={styles.acciones}>
                <TouchableOpacity
                  style={styles.agregar}
                  onPress={agregarLinea}
                  disabled={lineas.length >= MAX_RENGLONES}
                >
                  <Ionicons name="add" size={17} color={colors.muted} />
                  <Text style={styles.agregarText}>Agregar renglón</Text>
                </TouchableOpacity>
                {guardando ? <Text style={styles.guardando}>Guardando…</Text> : null}
              </View>
            </ScrollView>

            {/* Botón del día, fijo abajo */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
              <TouchableOpacity
                style={[
                  styles.leer,
                  leidoHoy && styles.leerHecho,
                  !hayEscritas && styles.leerDisabled,
                ]}
                onPress={alternarLeido}
                disabled={!hayEscritas}
              >
                {leidoHoy ? (
                  <>
                    <Ionicons name="checkmark" size={18} color={colors.green} />
                    <Text style={[styles.leerText, styles.leerTextHecho]}>Leídas hoy</Text>
                  </>
                ) : (
                  <Text style={styles.leerText}>Leí mis afirmaciones de hoy</Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
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

    loading: { flex: 1, alignItems: "center", justifyContent: "center" },
    scroll: { paddingHorizontal: 16, paddingBottom: 20, gap: 10 },

    fechaCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    fecha: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
      textTransform: "capitalize",
    },

    ayuda: { color: colors.muted, fontSize: 13, lineHeight: 18 },

    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    switchTitulo: { color: colors.text, fontSize: 14, fontWeight: "800" },
    switchDetalle: { color: colors.muted, fontSize: 12, marginTop: 2 },

    item: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    numero: {
      width: 26,
      height: 26,
      marginTop: 9,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.cardSoft,
    },
    numeroText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    input: {
      flex: 1,
      minHeight: 44,
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
    borrar: { padding: 8, marginTop: 6 },

    acciones: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
    agregar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.cardBorder,
    },
    agregarText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
    guardando: { color: colors.muted, fontSize: 12 },

    footer: {
      paddingHorizontal: 16,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
      backgroundColor: colors.bg,
    },
    leer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.greenBright,
    },
    // Ya marcado: baja el peso visual, es un estado confirmado y no una acción
    leerHecho: {
      backgroundColor: colors.greenSoft,
      borderWidth: 1,
      borderColor: colors.greenBorder,
    },
    leerDisabled: { opacity: 0.45 },
    leerText: { color: "#fff", fontSize: 15, fontWeight: "800" },
    leerTextHecho: { color: colors.green },
  });
