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
  Alert,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Speech from "expo-speech";
import * as SecureStore from "expo-secure-store";
import { afirmacionService } from "../api";
import { useTheme } from "../theme";
import { syncAfirmacionesReminder } from "../utils/afirmacionesReminder";

const RENGLONES_INICIALES = 5;
const MAX_RENGLONES = 30;

// Fecha local del teléfono en formato YYYY-MM-DD. No usamos toISOString() a
// secas porque devuelve UTC y a la noche cambia el día antes de tiempo.
const hoyLocal = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

// Construye la Date para el picker por componentes: nada de parsear strings,
// que según el motor/zona horaria corren la hora (el clásico "+1").
const horaADate = (hora) => {
  const [h, m] = String(hora || "08:00").split(":").map(Number);
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 8, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
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
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(colors, isDark);

  const [fecha, setFecha] = useState(hoyLocal);
  const [lineas, setLineas] = useState(() => Array(RENGLONES_INICIALES).fill(""));
  const [leidoHoy, setLeidoHoy] = useState(false);
  const [racha, setRacha] = useState(0);
  const [hablando, setHablando] = useState(false);
  const [leyendoIdx, setLeyendoIdx] = useState(null);
  const speakingRef = useRef(false);
  const pausaRef = useRef(null);
  const [repetirDiario, setRepetirDiario] = useState(true);
  const [recordatorio, setRecordatorio] = useState({ activo: false, hora: "08:00" });
  const [ajustesOpen, setAjustesOpen] = useState(false); // desplegable de la campanita
  const [showHoraPicker, setShowHoraPicker] = useState(false);
  // Hora provisoria mientras la ruedita está abierta (iOS): se guarda al tocar Listo.
  const [horaTemp, setHoraTemp] = useState("08:00");
  // Renglón con foco (para pintarle el borde verde) y estado del teclado
  // (para achicar el pie cuando está abierto y no dejar un hueco feo).
  const [focoIdx, setFocoIdx] = useState(null);
  const [tecladoAbierto, setTecladoAbierto] = useState(false);
  // Renglones resaltados (fijos): se prenden/apagan al tocar el número, así no
  // hace falta abrir el teclado para marcarlos.
  const [resaltadas, setResaltadas] = useState(() => new Set());

  const toggleResaltada = (indice) => {
    const next = new Set(resaltadas);
    if (next.has(indice)) next.delete(indice);
    else next.add(indice);
    setResaltadas(next);
    // Se guarda en el server para sincronizar con la web.
    afirmacionService.save({ resaltadas: [...next], fecha }).catch(() => {});
  };

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s1 = Keyboard.addListener(showEvt, () => setTecladoAbierto(true));
    const s2 = Keyboard.addListener(hideEvt, () => setTecladoAbierto(false));
    return () => {
      s1.remove();
      s2.remove();
    };
  }, []);
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
    setResaltadas(new Set(Array.isArray(data?.resaltadas) ? data.resaltadas : []));
    setLeidoHoy(Boolean(data?.leidoHoy));
    setRacha(Number(data?.racha) || 0);
    setRepetirDiario(data?.repetirDiario !== false);

    const rec = {
      activo: Boolean(data?.recordatorio?.activo),
      hora: data?.recordatorio?.hora || "08:00",
    };
    setRecordatorio(rec);
    // Re-programa la notificación al abrir: así el texto (leé/escribí)
    // refleja el estado actual de los renglones.
    syncAfirmacionesReminder({
      ...rec,
      lineas: completas,
      repetirDiario: data?.repetirDiario !== false,
    });
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

  // Borra TODAS las afirmaciones y arranca de cero (con confirmación).
  const resetearAfirmaciones = () => {
    Alert.alert(
      "Reset",
      "Se borrarán TODAS las afirmaciones para empezar de nuevo.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Aceptar",
          style: "destructive",
          onPress: () => {
            const vacias = Array(RENGLONES_INICIALES).fill("");
            setLineas(vacias);
            setResaltadas(new Set());
            if (guardadoRef.current) clearTimeout(guardadoRef.current);
            afirmacionService.save({ lineas: vacias, resaltadas: [], fecha }).catch(() => {});
          },
        },
      ]
    );
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

  const guardarRecordatorio = async (rec) => {
    setRecordatorio(rec);
    afirmacionService.save({ recordatorio: rec, fecha }).catch(() => {});
    const ok = await syncAfirmacionesReminder({ ...rec, lineas, repetirDiario });
    if (rec.activo && !ok) {
      // Sin permiso de notificaciones: volvemos atrás y avisamos.
      const apagado = { ...rec, activo: false };
      setRecordatorio(apagado);
      afirmacionService.save({ recordatorio: apagado, fecha }).catch(() => {});
      Alert.alert(
        "Notificaciones desactivadas",
        "Para recibir el recordatorio, permití las notificaciones de Growth en los ajustes del teléfono."
      );
    }
  };

  const alternarRepetir = () => {
    const proximo = !repetirDiario;
    setRepetirDiario(proximo); // optimista
    afirmacionService.save({ repetirDiario: proximo, fecha }).catch(() => {
      setRepetirDiario(!proximo); // si falló, volvemos al estado real
    });
    // El verbo de la notificación (leé/escribí) depende de este switch.
    syncAfirmacionesReminder({ ...recordatorio, lineas, repetirDiario: proximo });
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

  // ---- Voz: leer las afirmaciones en voz alta con la voz del dispositivo ----
  const detenerVoz = useCallback(() => {
    speakingRef.current = false;
    if (pausaRef.current) clearTimeout(pausaRef.current);
    Speech.stop();
    setHablando(false);
    setLeyendoIdx(null);
  }, []);

  const reproducir = useCallback(() => {
    const items = lineas
      .map((linea, i) => ({ texto: (linea || "").trim(), i }))
      .filter((x) => x.texto);
    if (!items.length) return;
    speakingRef.current = true;
    setHablando(true);
    let k = 0;
    const siguiente = () => {
      if (!speakingRef.current) return;
      if (k >= items.length) {
        speakingRef.current = false;
        setHablando(false);
        setLeyendoIdx(null);
        return;
      }
      const { texto, i } = items[k];
      setLeyendoIdx(i);
      Speech.speak(texto, {
        language: "es-AR",
        rate: 0.82,
        onDone: () => {
          k += 1;
          // Pausa mínima entre afirmaciones para que respire.
          pausaRef.current = setTimeout(siguiente, 550);
        },
        onError: () => {
          speakingRef.current = false;
          setHablando(false);
          setLeyendoIdx(null);
        },
      });
    };
    siguiente();
  }, [lineas]);

  const escucharAfirmaciones = useCallback(async () => {
    if (hablando) {
      detenerVoz();
      return;
    }
    // La primera vez avisamos que el teléfono no puede estar en silencio.
    try {
      const visto = await SecureStore.getItemAsync("afirmaciones_voz_aviso");
      if (!visto) {
        SecureStore.setItemAsync("afirmaciones_voz_aviso", "1").catch(() => {});
        Alert.alert(
          "Para escuchar 🔊",
          "Asegurate de que el teléfono no esté en silencio (el interruptor lateral) y subí el volumen.",
          [{ text: "Entendido", onPress: reproducir }]
        );
        return;
      }
    } catch {}
    reproducir();
  }, [hablando, detenerVoz, reproducir]);

  // Corta la voz al cerrar el panel o desmontar.
  useEffect(() => {
    if (!visible) detenerVoz();
  }, [visible, detenerVoz]);
  useEffect(() => () => Speech.stop(), []);

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
          </View>
          <TouchableOpacity
            style={[styles.playBtn, hablando && styles.playBtnOn, !hayEscritas && { opacity: 0.4 }]}
            onPress={escucharAfirmaciones}
            disabled={!hayEscritas}
            accessibilityLabel={hablando ? "Detener la lectura" : "Escuchar tus afirmaciones"}
          >
            <Ionicons
              name={hablando ? "stop" : "play"}
              size={13}
              color={hablando ? "#0e1a0e" : colors.green}
            />
            <Text style={[styles.playBtnText, hablando && styles.playBtnTextOn]}>
              {hablando ? "Detener" : "Escuchar"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetBtn} onPress={resetearAfirmaciones}>
            <Ionicons name="refresh" size={13} color={colors.muted} />
            <Text style={styles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
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
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
            >
              {/* El día de hoy */}
              <View style={styles.fechaCard}>
                <View style={styles.fechaLeft}>
                  <Ionicons name="sunny" size={20} color="#FFD60A" />
                  <Text style={styles.fecha}>{fechaLarga(fecha)}</Text>
                </View>
                <View style={styles.fechaRight}>
                  {racha > 0 ? (
                    <View style={styles.rachaPill}>
                      <Text style={styles.rachaText}>🔥 {racha}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.bellBtn, ajustesOpen && styles.bellBtnOn]}
                    onPress={() => setAjustesOpen((o) => !o)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={ajustesOpen ? "notifications" : "notifications-outline"}
                      size={19}
                      color={ajustesOpen ? colors.greenBright : colors.muted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Ajustes (se despliegan desde la campanita) */}
              {ajustesOpen ? (
                <View style={styles.ajustesCard}>
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

                  {/* Recordatorio diario con la afirmación del día */}
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchTitulo}>Recordatorio diario</Text>
                      <Text style={styles.switchDetalle}>
                        {recordatorio.activo
                          ? "Te llega una notificación con tu afirmación del día."
                          : "Activalo para que te llegue una afirmación por día."}
                      </Text>
                      {recordatorio.activo ? (
                        <TouchableOpacity
                          style={styles.horaBtn}
                          onPress={() => {
                            setHoraTemp(recordatorio.hora);
                            setShowHoraPicker(true);
                          }}
                        >
                          <Ionicons name="time-outline" size={14} color={colors.green} />
                          <Text style={styles.horaBtnText}>{recordatorio.hora} hs · cambiar</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <Switch
                      value={recordatorio.activo}
                      onValueChange={(valor) =>
                        guardarRecordatorio({ ...recordatorio, activo: valor })
                      }
                      trackColor={{ false: colors.cardBorder, true: colors.greenSoft }}
                      thumbColor={recordatorio.activo ? colors.greenBright : colors.muted}
                    />
                  </View>
                </View>
              ) : null}

              {showHoraPicker ? (
                Platform.OS === "ios" ? (
                  // iOS: la ruedita queda abierta; se confirma con el botón Listo.
                  <View style={styles.horaPickerBox}>
                    <DateTimePicker
                      value={horaADate(horaTemp)}
                      mode="time"
                      display="spinner"
                      onChange={(event, selected) => {
                        if (selected) {
                          setHoraTemp(
                            `${String(selected.getHours()).padStart(2, "0")}:${String(
                              selected.getMinutes()
                            ).padStart(2, "0")}`
                          );
                        }
                      }}
                    />
                    <TouchableOpacity
                      style={styles.horaListoBtn}
                      onPress={() => {
                        setShowHoraPicker(false);
                        guardarRecordatorio({ ...recordatorio, hora: horaTemp });
                      }}
                    >
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.horaListoText}>Listo</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Android: el diálogo se cierra solo al aceptar/cancelar.
                  <DateTimePicker
                    value={horaADate(recordatorio.hora)}
                    mode="time"
                    display="default"
                    onChange={(event, selected) => {
                      setShowHoraPicker(false);
                      if (selected) {
                        const hora = `${String(selected.getHours()).padStart(2, "0")}:${String(
                          selected.getMinutes()
                        ).padStart(2, "0")}`;
                        guardarRecordatorio({ ...recordatorio, hora });
                      }
                    }}
                  />
                )
              ) : null}

              <Text style={styles.ayuda}>
                {repetirDiario
                  ? "Escribí tus afirmaciones y leelas todos los días: podés editarlas cuando quieras."
                  : "Lo que escribas hoy se guarda igual, no se pierde."}
              </Text>

              {/* Renglones */}
              {lineas.map((linea, indice) => (
                <View key={indice} style={styles.item}>
                  <TouchableOpacity
                    style={[styles.numero, resaltadas.has(indice) && styles.numeroOn]}
                    onPress={() => toggleResaltada(indice)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.numeroText,
                        resaltadas.has(indice) && styles.numeroTextOn,
                      ]}
                    >
                      {indice + 1}
                    </Text>
                  </TouchableOpacity>
                  <View
                    style={[
                      styles.inputWrap,
                      (focoIdx === indice || resaltadas.has(indice) || leyendoIdx === indice) &&
                        styles.inputWrapFoco,
                    ]}
                  >
                    <TextInput
                      style={[
                        styles.input,
                        (focoIdx === indice || resaltadas.has(indice) || leyendoIdx === indice) &&
                          styles.inputTextFoco,
                      ]}
                      value={linea}
                      onChangeText={(valor) => editarLinea(indice, valor)}
                      onFocus={() => setFocoIdx(indice)}
                      onBlur={() => setFocoIdx((prev) => (prev === indice ? null : prev))}
                      placeholder="Escribí tu afirmación…"
                      placeholderTextColor={colors.muted}
                      multiline
                    />
                    {lineas.length > 1 ? (
                      <TouchableOpacity
                        style={styles.borrar}
                        onPress={() => borrarLinea(indice)}
                        accessibilityLabel={`Borrar renglón ${indice + 1}`}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={15} color={colors.muted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
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
            {/* Con el teclado abierto no hace falta la zona segura de abajo */}
            <View style={[styles.footer, { paddingBottom: tecladoAbierto ? 10 : insets.bottom + 12 }]}>
              <TouchableOpacity
                style={[
                  styles.leer,
                  leidoHoy && styles.leerHecho,
                  !hayEscritas && styles.leerDisabled,
                ]}
                onPress={alternarLeido}
                disabled={!hayEscritas}
              >
                <View style={[styles.leerCirculo, leidoHoy && styles.leerCirculoHecho]}>
                  {leidoHoy ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : null}
                </View>
                <Text style={[styles.leerText, leidoHoy && styles.leerTextHecho]}>
                  {leidoHoy ? "Leídas hoy" : "Leí mis afirmaciones de hoy"}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (colors, isDark = false) =>
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

    fechaRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    bellBtn: {
      width: 34,
      height: 34,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    bellBtnOn: { borderColor: colors.greenBright, backgroundColor: colors.greenSoft },
    ajustesCard: { gap: 10 },

    playBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.greenBorder,
      backgroundColor: colors.greenSoft,
    },
    playBtnOn: { backgroundColor: colors.greenBright, borderColor: colors.greenBright },
    playBtnText: { color: colors.green, fontSize: 12.5, fontWeight: "800" },
    playBtnTextOn: { color: "#0e1a0e" },

    loading: { flex: 1, alignItems: "center", justifyContent: "center" },
    scroll: { paddingHorizontal: 16, paddingBottom: 20, gap: 10 },

    // La fecha va a la izquierda y la racha (fueguito) a la derecha.
    fechaCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 6,
      paddingHorizontal: 2,
    },
    fechaLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    fecha: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
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
    // Botón chico "Reset" al lado del switch.
    resetBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    resetBtnText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    horaBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      alignSelf: "flex-start",
      marginTop: 6,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.greenSoft,
      borderWidth: 1,
      borderColor: colors.greenBorder,
    },
    horaBtnText: { color: colors.green, fontSize: 12, fontWeight: "800" },
    horaPickerBox: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      paddingBottom: 10,
      alignItems: "center",
    },
    horaListoBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 22,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: colors.greenBright,
    },
    horaListoText: { color: "#fff", fontSize: 13, fontWeight: "800" },

    item: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    numero: {
      width: 26,
      height: 26,
      marginTop: 9,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.cardSoft,
      // Borde fino verde (igual que en la web): marca el círculo interactivo.
      borderWidth: 1,
      borderColor: "rgba(59, 203, 35, 0.55)",
    },
    numeroText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    // Número activo cuando el renglón está resaltado.
    numeroOn: {
      backgroundColor: colors.greenBright,
      shadowColor: colors.greenBright,
      shadowOpacity: 0.6,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
      elevation: 5,
    },
    numeroTextOn: { color: "#06210a" },
    // El recuadro (borde/fondo/glow) ahora envuelve el input + el cesto.
    inputWrap: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      paddingRight: 4,
    },
    inputWrapFoco: {
      borderColor: colors.greenBright,
      borderWidth: 1.5,
      shadowColor: colors.greenBright,
      shadowOpacity: 0.55,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 0 },
      elevation: 6,
    },
    input: {
      flex: 1,
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 15,
      lineHeight: 20,
    },
    // Sólo el brillo del texto al resaltar (el borde/glow va en el wrapper).
    inputTextFoco: {
      color: colors.text,
      textShadowColor: isDark ? "rgba(123, 255, 77, 0.7)" : "transparent",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
    },
    // Renglón enfocado: borde verde brillante para saber dónde estás escribiendo
    borrar: { padding: 6 },

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
      gap: 8,
      paddingVertical: 14,
      borderRadius: 999,
      backgroundColor: colors.greenBright,
    },
    // Círculo tipo check (como en Tareas/web): vacío y se llena al marcar leídas.
    leerCirculo: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: "#fff",
      alignItems: "center",
      justifyContent: "center",
    },
    leerCirculoHecho: {
      borderColor: colors.green,
      backgroundColor: colors.green,
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
