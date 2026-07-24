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
  Keyboard,
  PanResponder,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { journalService } from "../api";
import { useTheme } from "../theme";

// Ánimo del día: 1 (muy mal) a 5 (muy bien). El 0 muestra la carita sin boca.
const CARA_VACIA = "😶";
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

const ENTRADA_VACIA = { animo: 0, gratitud: "", mejor: "", distinto: "", libre: "", extras: [] };

let extraSeq = 0;
const nuevoId = () => `x${Date.now().toString(36)}${(extraSeq++).toString(36)}`;

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

const pad = (n) => String(n).padStart(2, "0");
const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

const dayKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Grilla mensual (6 semanas) arrancando en lunes.
const buildMonthGrid = (ref) => {
  const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const start = new Date(first);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
};

const THUMB = 30;

const AnimoSlider = React.memo(function AnimoSlider({ value, onChange, styles }) {
  const [trackW, setTrackW] = useState(0);
  const trackWRef = useRef(0);
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  function calcular(x) {
    const w = trackWRef.current;
    if (!w) return 0;
    const usable = Math.max(1, w - THUMB);
    return Math.min(5, Math.max(0, Math.round(((x - THUMB / 2) / usable) * 5)));
  }

  function mover(x) {
    const v = calcular(x);
    if (dragRef.current !== v) {
      dragRef.current = v;
      setDrag(v);
    }
  }

  function soltar() {
    if (dragRef.current != null) onChangeRef.current(dragRef.current);
    dragRef.current = null;
    setDrag(null);
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => mover(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) => mover(evt.nativeEvent.locationX),
      onPanResponderRelease: soltar,
      onPanResponderTerminate: soltar,
    })
  ).current;

  const nivel = drag != null ? drag : Number(value) || 0;
  const usable = Math.max(0, trackW - THUMB);
  const thumbLeft = (nivel / 5) * usable;

  return (
    <View style={styles.animoSliderRow}>
      <View
        style={styles.animoSliderWrap}
        onLayout={(e) => {
          setTrackW(e.nativeEvent.layout.width);
          trackWRef.current = e.nativeEvent.layout.width;
        }}
        {...pan.panHandlers}
      >
        <View style={styles.animoTrack}>
          <View style={[styles.animoFill, { width: thumbLeft + THUMB / 2 }]} />
        </View>
        {[1, 2, 3, 4, 5].map((v) => (
          <View key={v} style={[styles.animoTick, { left: (v / 5) * usable + THUMB / 2 - 3 }]} />
        ))}
        <View style={[styles.animoThumb, { left: thumbLeft }]}>
          <Text style={styles.animoThumbEmoji}>{nivel > 0 ? emojiDe(nivel) : CARA_VACIA}</Text>
        </View>
      </View>
    </View>
  );
});

const tieneContenido = (e) =>
  Number(e?.animo) > 0 ||
  [e?.gratitud, e?.mejor, e?.distinto, e?.libre].some((c) => String(c || "").trim()) ||
  (Array.isArray(e?.extras) && e.extras.some((x) => String(x?.valor || "").trim()));

export default function JournalingPanel({ visible, onClose }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
  const [extras, setExtras] = useState([]); // definiciones [{id, texto}]
  const [borradorExtras, setBorradorExtras] = useState([]);
  const [vista, setVista] = useState("libro"); // libro (hoja editable) | calendario
  const [calRef, setCalRef] = useState(() => new Date());
  const guardadoRef = useRef(null);

  // Switch Libro/Calendario con pastilla deslizante (igual que la web).
  const [toggleW, setToggleW] = useState(0);
  const toggleAnim = useRef(new Animated.Value(0)).current; // 0=libro, 1=calendario
  useEffect(() => {
    Animated.timing(toggleAnim, {
      toValue: vista === "calendario" ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [vista, toggleAnim]);

  const editarRef = useRef(() => {});
  const onAnimoChange = useCallback((v) => editarRef.current("animo", v), []);

  const aplicar = useCallback((data) => {
    setEntrada(data?.hoy ? { ...ENTRADA_VACIA, ...data.hoy } : ENTRADA_VACIA);
    setHistorial(Array.isArray(data?.entradas) ? data.entradas : []);
    setRacha(Number(data?.racha) || 0);
    if (data?.preguntas) setPreguntas({ ...PREGUNTAS_DEFAULT, ...data.preguntas });
    setExtras(Array.isArray(data?.extras) ? data.extras : []);
  }, []);

  // Al abrir el panel volvemos siempre al día de hoy.
  useEffect(() => {
    if (visible) setFecha(hoyLocal());
  }, [visible]);

  // Cargamos el día activo (hoy o el que se abra del calendario/flechas).
  useEffect(() => {
    if (!visible) return;
    setCargando(true);
    journalService
      .get(fecha)
      .then(({ data }) => aplicar(data))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [visible, fecha, aplicar]);

  // Autoguardado PARCIAL: se mandan solo los campos tocados en esta sesión.
  // Así un estado viejo o vacío jamás puede pisar lo que ya está guardado.
  const pendienteRef = useRef({});
  const guardarDiferido = useCallback(() => {
    if (guardadoRef.current) clearTimeout(guardadoRef.current);
    guardadoRef.current = setTimeout(async () => {
      const cambios = { ...pendienteRef.current };
      if (!Object.keys(cambios).length) return;
      pendienteRef.current = {};
      setGuardando(true);
      try {
        const { data } = await journalService.save({ ...cambios, fecha });
        setHistorial(Array.isArray(data?.entradas) ? data.entradas : []);
        setRacha(Number(data?.racha) || 0);
      } catch {
        // Reencola lo no guardado sin pisar ediciones nuevas.
        pendienteRef.current = { ...cambios, ...pendienteRef.current };
      } finally {
        setGuardando(false);
      }
    }, 800);
  }, [fecha]);

  useEffect(() => () => guardadoRef.current && clearTimeout(guardadoRef.current), []);

  const editar = (campo, valor) => {
    setEntrada((prev) => {
      if (prev[campo] === valor) return prev;
      return { ...prev, [campo]: valor };
    });
    pendienteRef.current[campo] = valor;
    guardarDiferido();
  };
  editarRef.current = editar;

  const editarExtra = (id, valor) => {
    const cur = entrada.extras || [];
    const existente = cur.find((x) => x.id === id);
    // Preserva el texto del snapshot (día viejo) o toma el de la config (hoy).
    const texto = existente?.texto || extras.find((x) => x.id === id)?.texto || "";
    const list = existente
      ? cur.map((x) => (x.id === id ? { ...x, texto, valor } : x))
      : [...cur, { id, texto, valor }];
    pendienteRef.current.extras = list;
    setEntrada((prev) => ({ ...prev, extras: list }));
    guardarDiferido();
  };

  // Preguntas extra a mostrar: hoy usa las definiciones de la config; los días
  // viejos, el snapshot que quedó en esa entrada.
  const extrasVista = () => {
    if (fecha === hoyLocal()) {
      return extras.map((d) => ({
        id: d.id,
        texto: d.texto,
        valor: (entrada.extras || []).find((x) => x.id === d.id)?.valor || "",
      }));
    }
    return (entrada.extras || []).map((x) => ({ id: x.id, texto: x.texto, valor: x.valor || "" }));
  };

  const elegirAnimo = (valor) => {
    editar("animo", Number(entrada.animo) === valor ? 0 : valor);
  };

  const guardarPreguntas = async () => {
    const limpio = borradorExtras
      .map((x) => ({ id: x.id || nuevoId(), texto: String(x.texto || "").trim() }))
      .filter((x) => x.texto);
    // Optimista: se ve el cambio al instante y guarda a la primera.
    setPreguntas({ ...PREGUNTAS_DEFAULT, ...borradorPreguntas });
    setExtras(limpio);
    setEditandoPreguntas(false);
    try {
      const { data } = await journalService.savePreguntas({
        ...borradorPreguntas,
        extras: limpio,
        fecha,
      });
      if (data?.preguntas) setPreguntas({ ...PREGUNTAS_DEFAULT, ...data.preguntas });
      if (Array.isArray(data?.extras)) setExtras(data.extras);
    } catch {
      /* quedó lo optimista */
    }
  };

  // Guarda lo pendiente antes de cambiar de día (para no perder nada) y navega.
  const flushGuardado = async () => {
    if (guardadoRef.current) {
      clearTimeout(guardadoRef.current);
      guardadoRef.current = null;
    }
    const cambios = { ...pendienteRef.current };
    pendienteRef.current = {};
    if (!Object.keys(cambios).length) return;
    try {
      await journalService.save({ ...cambios, fecha });
    } catch {
      pendienteRef.current = { ...cambios, ...pendienteRef.current };
    }
  };

  const irADia = async (f, { libro = false } = {}) => {
    if (!f) return;
    if (f !== fecha) {
      await flushGuardado();
      setFecha(f);
    }
    if (libro) setVista("libro");
  };

  // Historial (otros días con contenido) + el día activo en vivo (editable).
  const mapEntradas = new Map();
  historial.filter(tieneContenido).forEach((e) => mapEntradas.set(e.fecha, e));
  mapEntradas.set(fecha, { ...entrada, fecha });
  const entradas = [...mapEntradas.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const porFecha = new Map(entradas.map((e) => [e.fecha, e]));

  // Ánimo en el tiempo (últimos 30 días con ánimo marcado).
  const animoSerie = entradas.filter((e) => Number(e.animo) > 0).slice(-30);

  // La página del libro es el día activo (el que se está editando).
  const libroIdx = entradas.findIndex((e) => e.fecha === fecha);

  // Preguntas de una entrada: el día activo usa las actuales; los días viejos
  // usan el snapshot que quedó guardado ese día.
  const preguntasVista = (e) => {
    if (!e || e.fecha === fecha) return preguntas;
    const snap = e.preguntas || {};
    // Días viejos sin snapshot propio caen al DEFAULT (no a las preguntas
    // actuales): así cambiar las preguntas hoy nunca reescribe los días viejos.
    return {
      gratitud: snap.gratitud || PREGUNTAS_DEFAULT.gratitud,
      mejor: snap.mejor || PREGUNTAS_DEFAULT.mejor,
      distinto: snap.distinto || PREGUNTAS_DEFAULT.distinto,
    };
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
            <View style={styles.kickerRow}>
              <Text style={styles.kicker}>JOURNALING</Text>
              <Text style={styles.headerFecha} numberOfLines={1}>
                {fechaLarga(fecha)}
              </Text>
            </View>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Tu journal</Text>
              {fecha !== hoyLocal() ? (
                <TouchableOpacity style={styles.hoyBtn} onPress={() => irADia(hoyLocal())}>
                  <Text style={styles.hoyBtnText}>Hoy</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
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
              {/* Ánimo: slider con carita viajera */}
              <View style={styles.animoBox}>
                <Text style={styles.animoLabel}>¿CÓMO TE SENTÍS HOY?</Text>
                <AnimoSlider value={entrada.animo} onChange={onAnimoChange} styles={styles} />
              </View>

              {/* Switch Libro / Calendario con pastilla deslizante */}
              <View
                style={styles.vistaToggle}
                onLayout={(e) => setToggleW(e.nativeEvent.layout.width)}
              >
                {toggleW > 0 ? (
                  <Animated.View
                    style={[
                      styles.vistaThumb,
                      {
                        width: (toggleW - 8) / 2,
                        transform: [
                          {
                            translateX: toggleAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, (toggleW - 8) / 2],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                ) : null}
                <TouchableOpacity
                  style={styles.vistaBtn}
                  activeOpacity={0.8}
                  onPress={() => setVista("libro")}
                >
                  <Ionicons
                    name="book-outline"
                    size={15}
                    color={vista === "libro" ? "#0e1a0e" : colors.muted}
                  />
                  <Text style={[styles.vistaBtnText, vista === "libro" && styles.vistaBtnTextActivo]}>
                    Libro
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.vistaBtn}
                  activeOpacity={0.8}
                  onPress={() => setVista("calendario")}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color={vista === "calendario" ? "#0e1a0e" : colors.muted}
                  />
                  <Text
                    style={[styles.vistaBtnText, vista === "calendario" && styles.vistaBtnTextActivo]}
                  >
                    Calendario
                  </Text>
                </TouchableOpacity>
              </View>

              {vista === "calendario" ? (
                <View style={styles.calBox}>
                  <View style={styles.calNav}>
                    <TouchableOpacity
                      style={styles.calNavBtn}
                      onPress={() => setCalRef(new Date(calRef.getFullYear(), calRef.getMonth() - 1, 1))}
                    >
                      <Ionicons name="chevron-back" size={16} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.calMes}>
                      {calRef.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
                    </Text>
                    <View style={styles.calNavDerecha}>
                      <TouchableOpacity
                        style={styles.calNavBtn}
                        onPress={() => setCalRef(new Date(calRef.getFullYear(), calRef.getMonth() + 1, 1))}
                      >
                        <Ionicons name="chevron-forward" size={16} color={colors.text} />
                      </TouchableOpacity>
                      {racha > 0 ? (
                        <View style={styles.rachaPill}>
                          <Text style={styles.rachaText}>🔥 {racha} {racha === 1 ? "día" : "días"}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.calWeekRow}>
                    {WEEKDAYS.map((d, i) => (
                      <Text key={`${d}-${i}`} style={styles.calWeekday}>
                        {d}
                      </Text>
                    ))}
                  </View>
                  <View style={styles.calGrid}>
                    {buildMonthGrid(calRef).map((d) => {
                      const key = dayKeyOf(d);
                      const e = porFecha.get(key);
                      const esHoy = key === hoyLocal();
                      const fuera = d.getMonth() !== calRef.getMonth();
                      const esFuturo = key > hoyLocal();
                      return (
                        <TouchableOpacity
                          key={key}
                          style={[
                            styles.calCell,
                            esHoy && styles.calCellHoy,
                            e && tieneContenido(e) && styles.calCellConEntrada,
                            key === fecha && styles.calCellActiva,
                          ]}
                          disabled={esFuturo}
                          onPress={() => irADia(key, { libro: true })}
                        >
                          <Text style={[styles.calDia, fuera && styles.calDiaFuera]}>{d.getDate()}</Text>
                          {e && tieneContenido(e) ? (
                            <View
                              style={[
                                styles.calDot,
                                { backgroundColor: ANIMO_COLORS[Number(e.animo)] || colors.greenBright },
                              ]}
                            />
                          ) : (
                            <View style={styles.calDotVacio} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.calAyuda}>
                    Tocá cualquier día para abrirlo y escribir; el puntito marca los que ya tienen algo.
                  </Text>
                </View>
              ) : libroIdx < 0 ? (
                <View style={styles.libroVacio}>
                  <Ionicons name="book-outline" size={26} color={colors.green} />
                  <Text style={styles.libroVacioText}>
                    Todavía no hay páginas escritas. Lo que escribas hoy va a aparecer acá.
                  </Text>
                </View>
              ) : (
                <View style={styles.libroPage}>
                  <View style={styles.libroMargen} />
                  {racha > 0 ? (
                    <View style={styles.rachaEnHoja}>
                      <Text style={styles.rachaEnHojaText}>🔥 {racha} {racha === 1 ? "día" : "días"}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.libroFecha}>{fechaLarga(entradas[libroIdx].fecha)}</Text>
                  {Number(entradas[libroIdx].animo) > 0 ? (
                    <Text style={styles.libroAnimo}>{emojiDe(entradas[libroIdx].animo)}</Text>
                  ) : null}

                  {true ? (
                    /* Día activo: se escribe directo sobre el papel */
                    <>
                      {fecha === hoyLocal() ? (
                      <View style={styles.libroEditRow}>
                        {editandoPreguntas ? (
                          <>
                            <TouchableOpacity style={styles.libroEditBtn} onPress={guardarPreguntas}>
                              <Ionicons name="checkmark" size={13} color="#2b2416" />
                              <Text style={styles.libroEditBtnText}>Guardar preguntas</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.libroEditBtn}
                              onPress={() => setEditandoPreguntas(false)}
                            >
                              <Ionicons name="close" size={13} color="#2b2416" />
                              <Text style={styles.libroEditBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <TouchableOpacity
                            style={styles.libroEditBtn}
                            onPress={() => {
                              setBorradorPreguntas(preguntas);
                              setBorradorExtras(extras.map((x) => ({ ...x })));
                              setEditandoPreguntas(true);
                            }}
                          >
                            <Ionicons name="pencil" size={12} color="#2b2416" />
                            <Text style={styles.libroEditBtnText}>Personalizar preguntas</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      ) : null}

                      {CAMPOS.map((p) => (
                        <View key={p.campo}>
                          {editandoPreguntas ? (
                            <TextInput
                              style={styles.libroPreguntaInput}
                              value={borradorPreguntas[p.campo]}
                              onChangeText={(v) =>
                                setBorradorPreguntas((prev) => ({ ...prev, [p.campo]: v }))
                              }
                              placeholder={PREGUNTAS_DEFAULT[p.campo]}
                              placeholderTextColor="rgba(138, 90, 42, 0.5)"
                              maxLength={200}
                            />
                          ) : (
                            <Text style={styles.libroPregunta}>{preguntasVista(entradas[libroIdx])[p.campo]}</Text>
                          )}
                          <TextInput
                            style={styles.libroInput}
                            value={entrada[p.campo]}
                            onChangeText={(v) => editar(p.campo, v)}
                            placeholder={p.placeholder}
                            placeholderTextColor="rgba(43, 36, 22, 0.35)"
                            multiline
                            editable={!editandoPreguntas}
                          />
                        </View>
                      ))}

                      {/* Preguntas extra */}
                      {editandoPreguntas ? (
                        <>
                          {borradorExtras.map((x) => (
                            <View key={x.id} style={styles.extraEditRow}>
                              <TextInput
                                style={[styles.libroPreguntaInput, { flex: 1 }]}
                                value={x.texto}
                                onChangeText={(v) =>
                                  setBorradorExtras((prev) =>
                                    prev.map((it) => (it.id === x.id ? { ...it, texto: v } : it))
                                  )
                                }
                                placeholder="Tu pregunta…"
                                placeholderTextColor="rgba(138, 90, 42, 0.5)"
                                maxLength={200}
                              />
                              <TouchableOpacity
                                onPress={() =>
                                  setBorradorExtras((prev) => prev.filter((it) => it.id !== x.id))
                                }
                                hitSlop={8}
                              >
                                <Ionicons name="trash-outline" size={16} color="#8a5a2a" />
                              </TouchableOpacity>
                            </View>
                          ))}
                          <TouchableOpacity
                            style={styles.agregarPreguntaBtn}
                            onPress={() =>
                              setBorradorExtras((prev) => [...prev, { id: nuevoId(), texto: "" }])
                            }
                          >
                            <Ionicons name="add" size={15} color="#2b2416" />
                            <Text style={styles.agregarPreguntaText}>Agregar pregunta</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        extrasVista().map((x) => (
                          <View key={x.id}>
                            <Text style={styles.libroPregunta}>{x.texto}</Text>
                            <TextInput
                              style={styles.libroInput}
                              value={x.valor}
                              onChangeText={(v) => editarExtra(x.id, v)}
                              placeholder="Escribí tu respuesta…"
                              placeholderTextColor="rgba(43, 36, 22, 0.35)"
                              multiline
                            />
                          </View>
                        ))
                      )}

                      <TextInput
                        style={[styles.libroInput, styles.libroInputLibre]}
                        value={entrada.libre}
                        onChangeText={(v) => editar("libre", v)}
                        placeholder="Notas libres de este día…"
                        placeholderTextColor="rgba(43, 36, 22, 0.35)"
                        multiline
                        editable={!editandoPreguntas}
                      />
                      {guardando ? <Text style={styles.libroGuardando}>Guardando…</Text> : null}
                    </>
                  ) : (
                    /* Páginas anteriores: solo lectura */
                    <>
                      {CAMPOS.map((p) =>
                        entradas[libroIdx][p.campo] ? (
                          <View key={p.campo}>
                            <Text style={styles.libroPregunta}>{preguntas[p.campo]}</Text>
                            <Text style={styles.libroTexto}>{entradas[libroIdx][p.campo]}</Text>
                          </View>
                        ) : null
                      )}
                      {entradas[libroIdx].libre ? (
                        <Text style={styles.libroTexto}>{entradas[libroIdx].libre}</Text>
                      ) : null}
                    </>
                  )}

                  <View style={styles.libroNav}>
                    <TouchableOpacity
                      style={[styles.libroNavBtn, libroIdx <= 0 && styles.libroNavBtnOff]}
                      disabled={libroIdx <= 0}
                      onPress={() => irADia(entradas[libroIdx - 1]?.fecha)}
                    >
                      <Ionicons name="chevron-back" size={16} color="#2b2416" />
                    </TouchableOpacity>
                    <Text style={styles.libroPagina}>
                      Página {libroIdx + 1} de {entradas.length}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.libroNavBtn,
                        libroIdx >= entradas.length - 1 && styles.libroNavBtnOff,
                      ]}
                      disabled={libroIdx >= entradas.length - 1}
                      onPress={() => irADia(entradas[libroIdx + 1]?.fecha)}
                    >
                      <Ionicons name="chevron-forward" size={16} color="#2b2416" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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
    kickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    title: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 2 },
    titleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, flexWrap: "nowrap" },
    headerFecha: {
      flexShrink: 1,
      color: colors.muted,
      fontSize: 12.5,
      fontWeight: "700",
      textTransform: "capitalize",
    },
    rachaPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.greenBorder,
      backgroundColor: colors.greenSoft,
    },
    rachaText: { color: colors.green, fontSize: 13, fontWeight: "800" },

    scroll: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 30, gap: 12 },

    fechaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 6,
    },
    fecha: { color: colors.text, fontSize: 16, fontWeight: "800", textTransform: "capitalize" },

    /* Sin caja: el slider vive suelto sobre el fondo */
    animoBox: { gap: 10, paddingHorizontal: 2 },
    animoLabel: { color: colors.muted, fontSize: 10.5, fontWeight: "800", letterSpacing: 1 },
    animoSliderRow: { flexDirection: "row", alignItems: "center" },
    animoSliderWrap: { flex: 1, height: 40, justifyContent: "center" },
    animoTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: colors.cardSoft,
      overflow: "hidden",
    },
    animoFill: { height: "100%", borderRadius: 999, backgroundColor: colors.greenBright },
    /* Puntito vacío en cada posición donde cambia la cara */
    animoTick: {
      position: "absolute",
      top: 17,
      width: 6,
      height: 6,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: colors.muted,
      backgroundColor: colors.card,
    },
    animoThumb: {
      position: "absolute",
      top: 5,
      width: 30,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
    },
    animoThumbEmoji: { fontSize: 24 },
    calNavDerecha: { flexDirection: "row", alignItems: "center", gap: 8 },
    rachaEnHoja: {
      position: "absolute",
      top: 10,
      right: 10,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: "rgba(93, 199, 45, 0.22)",
    },
    rachaEnHojaText: { color: "#2f6f35", fontSize: 11.5, fontWeight: "800" },
    hoyBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.greenBorder,
      backgroundColor: colors.greenSoft,
    },
    hoyBtnText: { color: colors.green, fontSize: 12.5, fontWeight: "800" },
    calCellActiva: { borderColor: colors.greenBright },

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

    vistaToggle: {
      position: "relative",
      flexDirection: "row",
      padding: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    vistaThumb: {
      position: "absolute",
      top: 4,
      bottom: 4,
      left: 4,
      borderRadius: 999,
      backgroundColor: colors.greenBright,
    },
    vistaBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      borderRadius: 999,
    },
    vistaBtnText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
    vistaBtnTextActivo: { color: "#0e1a0e" },

    calBox: {
      flexGrow: 1,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      gap: 8,
    },
    calNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    calNavBtn: {
      width: 30,
      height: 30,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    calMes: { color: colors.text, fontSize: 13.5, fontWeight: "800", textTransform: "capitalize" },
    calWeekRow: { flexDirection: "row" },
    calWeekday: {
      flex: 1,
      textAlign: "center",
      color: colors.muted,
      fontSize: 10.5,
      fontWeight: "800",
    },
    calGrid: { flexDirection: "row", flexWrap: "wrap" },
    calCell: {
      width: `${100 / 7}%`,
      minHeight: 42,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "transparent",
      paddingVertical: 4,
    },
    calCellHoy: { borderColor: colors.greenBorder },
    calCellConEntrada: { backgroundColor: colors.greenSoft },
    calDia: { color: colors.text, fontSize: 12.5, fontWeight: "600" },
    calDiaFuera: { opacity: 0.3 },
    calDot: { width: 6, height: 6, borderRadius: 999 },
    calDotVacio: { width: 6, height: 6 },
    calAyuda: { color: colors.muted, fontSize: 11.5 },

    /* Hoja de cuaderno: papel crema a propósito, no cambia con el tema */
    libroPage: {
      flexGrow: 1,
      minHeight: 440,
      padding: 18,
      paddingLeft: 34,
      borderRadius: 12,
      backgroundColor: "#faf4e3",
      overflow: "hidden",
      gap: 8,
    },
    libroMargen: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 24,
      width: 2,
      backgroundColor: "rgba(214, 106, 106, 0.55)",
    },
    libroFecha: {
      color: "#2b2416",
      fontSize: 16,
      fontWeight: "700",
      textTransform: "capitalize",
      textDecorationLine: "underline",
      fontFamily: Platform.OS === "ios" ? "Noteworthy" : "cursive",
    },
    libroAnimo: { fontSize: 20 },
    libroPregunta: {
      color: "#8a5a2a",
      fontSize: 13.5,
      fontWeight: "700",
      fontFamily: Platform.OS === "ios" ? "Noteworthy" : "cursive",
    },
    libroTexto: {
      color: "#2b2416",
      fontSize: 15,
      lineHeight: 24,
      fontFamily: Platform.OS === "ios" ? "Noteworthy" : "cursive",
    },
    // Flotante arriba a la derecha, a la altura de la carita (no ocupa fila).
    libroEditRow: {
      position: "absolute",
      top: 44,
      right: 12,
      zIndex: 3,
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 7,
    },
    libroEditBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: "rgba(43, 36, 22, 0.4)",
    },
    libroEditBtnText: { color: "#2b2416", fontSize: 11, fontWeight: "700" },
    libroPreguntaInput: {
      color: "#8a5a2a",
      fontSize: 13.5,
      fontWeight: "700",
      paddingVertical: 4,
      paddingHorizontal: 0,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(138, 90, 42, 0.4)",
      fontFamily: Platform.OS === "ios" ? "Noteworthy" : "cursive",
    },
    libroInput: {
      minHeight: 42,
      paddingVertical: 6,
      paddingHorizontal: 0,
      color: "#2b2416",
      fontSize: 15,
      lineHeight: 24,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(43, 36, 22, 0.18)",
      fontFamily: Platform.OS === "ios" ? "Noteworthy" : "cursive",
      textAlignVertical: "top",
    },
    libroInputLibre: { minHeight: 90 },
    extraEditRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    agregarPreguntaBtn: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: "rgba(43, 36, 22, 0.4)",
    },
    agregarPreguntaText: { color: "#2b2416", fontSize: 12.5, fontWeight: "800" },
    libroGuardando: { color: "rgba(43, 36, 22, 0.5)", fontSize: 11.5 },

    libroNav: {
      marginTop: "auto",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      paddingTop: 10,
    },
    libroNavBtn: {
      width: 30,
      height: 30,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(43, 36, 22, 0.4)",
      alignItems: "center",
      justifyContent: "center",
    },
    libroNavBtnOff: { opacity: 0.3 },
    libroPagina: { color: "#2b2416", fontSize: 12.5, fontWeight: "700" },
    libroVacio: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 30,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.cardBorder,
    },
    libroVacioText: { color: colors.muted, fontSize: 12.5, textAlign: "center", lineHeight: 17 },

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
