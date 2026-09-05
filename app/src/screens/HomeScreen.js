// Home de Finanzas — tabs AR$/US$/Deudas/Ahorros (contenedor redondeado gris)
// y card de saldo que tapa el contenedor a la mitad, como en el Figma.
// El medio sigue el formato del mockup "blanco": sparkline del saldo dentro de
// la card, 4 acciones como círculos con barrita de color, pastillas
// Resumen/Historial y lista abierta sin marco, con separador punteado y
// footer "Gracias por utilizar GROWTH MANAGER".
// Los 3 iconos de la card: historial, ojo (ocultar montos) y paleta (color).
// Escala: u = (width/738) * 1.15, igual que el Lobby.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Easing,
  Modal,
  Alert,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from "react-native-svg";
import * as SecureStore from "expo-secure-store";
import { movimientoService } from "../api";
import MovementFormModal from "../components/MovementFormModal";
import HistoryModal from "../components/HistoryModal";
import {
  filterMovimientosByCurrency,
  formatMoney,
  formatSignedMoney,
  getCurrencyMeta,
  getMovementTypeMeta,
  isSameMonth,
  summarizeByType,
} from "../utils/finance";

// Paleta fija del rediseño (no sigue el tema claro/oscuro: el Figma es uno solo)
const BG = "#10150f";
const VERDE = "#75f94c";
const ROJO = "#eb3223";
const GRIS_BORDE = "#4e4e4e";
const GRIS_PILL = "#4f4f4f";
const TXT = "#ffffff";
const MUTED = "rgba(255,255,255,0.6)";
const LINEA = "rgba(255,255,255,0.14)";

// Colores de la columna Balance, calcados del Figma
const ACCENTS = {
  resultado: "#575dfb",
  ingreso: "#75f94c",
  egreso: "#eb3223",
  ahorro: "#ffffff",
  deuda: "#f4c622",
  movimientos: "#ff3465",
};

// Ícono según el tipo de movimiento (mismo criterio que el historial).
const movementIcon = (m) => {
  if (m.desdeAhorro) return "swap-horizontal-outline";
  if (m.tipo === "ingreso") return "arrow-down-outline";
  if (m.tipo === "ahorro") return "wallet-outline";
  if (m.tipo === "deuda") return "card-outline";
  return "arrow-up-outline"; // egreso
};

// Etiquetas como en el Figma: AR$ / US$
const HOME_TABS = [
  { key: "ARS", label: "AR$" },
  { key: "USD", label: "US$" },
  { key: "deuda", label: "Deudas" },
  { key: "ahorro", label: "Ahorros" },
];

const fmtDate = (value) => {
  const s = String(value || "").slice(0, 10);
  const [y, m, d] = s.split("-");
  return y && m && d ? `${d}/${m}/${y}` : s;
};

// Camino suavizado (curvas por punto medio, como los sparklines de la web)
const smoothPath = (pts) => {
  if (!pts.length) return "";
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const mx = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1);
    d += ` C${mx} ${pts[i - 1].y.toFixed(1)}, ${mx} ${pts[i].y.toFixed(1)}, ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }
  return d;
};

// Sparkline del saldo dentro de la tarjeta (formato del mockup)
const BalanceSpark = ({ serie, width, height, color, fillColor }) => {
  if (!width || serie.length < 2) return null;
  const min = Math.min(...serie);
  const max = Math.max(...serie);
  const flat = max - min === 0;
  const span = max - min || 1;
  const padY = height * 0.16;
  const pts = serie.map((v, i) => ({
    x: (i / (serie.length - 1)) * width,
    // Serie sin variación: línea al medio, no pegada al piso
    y: flat ? height / 2 : height - padY - ((v - min) / span) * (height - padY * 2),
  }));
  const line = smoothPath(pts);
  const area = `${line} L${width} ${height} L0 ${height} Z`;
  return (
    <Svg width={width} height={height}>
      <Path d={area} fill={fillColor} />
      <Path d={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
};

const CARD_STYLE_KEY = "gm_card_style";

// Estilos de la tarjeta de saldo (elegibles con la paleta, que da vuelta la tarjeta).
// "grafito" es el degradado gris del Figma y queda como predeterminado.
const CARD_STYLES = {
  grafito: {
    label: "Grafito",
    swatch: "#4f4f4f",
    stops: ["#4f4f4f", "#7e7c7c", "#4f4f4f"],
    backup: "#4f4f4f",
    text: "#ffffff",
    muted: "rgba(255, 255, 255, 0.72)",
    iconBorder: "rgba(255, 255, 255, 0.28)",
    iconBg: "rgba(255, 255, 255, 0.13)",
    glow1: "rgba(255, 255, 255, 0.2)",
    glow3: "rgba(255, 255, 255, 0.1)",
    lineColor: "rgba(255, 255, 255, 0.35)",
  },
  holo: {
    label: "Holográfico",
    swatch: "#c8b8ff",
    stops: ["#a8e6ff", "#ffc2e6", "#b8f5cf"],
    backup: "#c8b8ff",
    text: "#10151b",
    muted: "rgba(16, 21, 27, 0.62)",
    iconBorder: "rgba(16, 21, 27, 0.28)",
    iconBg: "rgba(255, 255, 255, 0.4)",
    glow1: "rgba(255, 255, 255, 0.3)",
    glow3: "rgba(255, 194, 230, 0.3)",
    lineColor: "rgba(255, 255, 255, 0.38)",
  },
  platino: {
    label: "Platino",
    swatch: "#dbe3ec",
    stops: ["#f4f7fa", "#c7d0da", "#dfe6ee"],
    backup: "#d6dfe8",
    text: "#10151b",
    muted: "rgba(16, 21, 27, 0.6)",
    iconBorder: "rgba(16, 21, 27, 0.25)",
    iconBg: "rgba(255, 255, 255, 0.5)",
    glow1: "rgba(255, 255, 255, 0.5)",
    glow3: "rgba(255, 255, 255, 0.4)",
    lineColor: "rgba(255, 255, 255, 0.55)",
  },
  titanio: {
    label: "Titanio",
    swatch: "#6b7480",
    stops: ["#565f6a", "#8b95a1", "#3c434c"],
    backup: "#565f6a",
    text: "#f2f8fb",
    muted: "rgba(242, 248, 251, 0.72)",
    iconBorder: "rgba(242, 248, 251, 0.28)",
    iconBg: "rgba(255, 255, 255, 0.12)",
    glow1: "rgba(255, 255, 255, 0.2)",
    glow3: "rgba(255, 255, 255, 0.12)",
    lineColor: "rgba(255, 255, 255, 0.3)",
  },
  chrome: {
    label: "Chrome",
    swatch: "#2b3138",
    stops: ["#20252c", "#454c56", "#1a1e24"],
    backup: "#20252c",
    text: "#f2f8fb",
    muted: "rgba(242, 248, 251, 0.7)",
    iconBorder: "rgba(242, 248, 251, 0.22)",
    iconBg: "rgba(255, 255, 255, 0.1)",
    glow1: "rgba(255, 255, 255, 0.22)",
    glow3: "rgba(255, 255, 255, 0.1)",
    lineColor: "rgba(255, 255, 255, 0.28)",
  },
  esmeralda: {
    label: "Esmeralda",
    swatch: "#16d97a",
    stops: ["#12c46f", "#23e58a", "#0c9a5c"],
    backup: "#12c46f",
    text: "#08251a",
    muted: "rgba(8, 37, 26, 0.7)",
    iconBorder: "rgba(8, 37, 26, 0.25)",
    iconBg: "rgba(255, 255, 255, 0.3)",
    glow1: "rgba(255, 255, 255, 0.35)",
    glow3: "rgba(255, 255, 255, 0.22)",
    lineColor: "rgba(255, 255, 255, 0.4)",
  },
  champagne: {
    label: "Champagne",
    swatch: "#d9b877",
    stops: ["#fbf3dd", "#d9b877", "#c9a55f"],
    backup: "#e6cf9a",
    text: "#2a2010",
    muted: "rgba(42, 32, 16, 0.62)",
    iconBorder: "rgba(42, 32, 16, 0.28)",
    iconBg: "rgba(255, 255, 255, 0.4)",
    glow1: "rgba(255, 255, 255, 0.4)",
    glow3: "rgba(255, 255, 255, 0.28)",
    lineColor: "rgba(255, 255, 255, 0.45)",
  },
};
const CARD_ORDER = ["grafito", "holo", "platino", "titanio", "chrome", "esmeralda", "champagne"];

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const u = (width / 738) * 1.15;
  const styles = useMemo(() => makeStyles(u), [u]);
  const [fontsLoaded] = useFonts({
    "Menda-Bold": require("../../assets/fonts/Menda-Bold.ttf"),
    "Menda-Medium": require("../../assets/fonts/Menda-Medium.ttf"),
  });

  // Brillo diagonal que se desliza sobre la tarjeta
  const sheen = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(sheen, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sheen, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sheen]);

  const [cardStyleKey, setCardStyleKey] = useState("grafito");
  const [flipped, setFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const card = CARD_STYLES[cardStyleKey] || CARD_STYLES.grafito;

  // Cargar el estilo de tarjeta guardado
  useEffect(() => {
    SecureStore.getItemAsync(CARD_STYLE_KEY)
      .then((k) => {
        if (k && CARD_STYLES[k]) setCardStyleKey(k);
      })
      .catch(() => {});
  }, []);

  const flipCard = () => {
    const next = !flipped;
    setFlipped(next);
    Animated.timing(flipAnim, {
      toValue: next ? 1 : 0,
      duration: 480,
      useNativeDriver: true,
    }).start();
  };

  const chooseCard = (key) => {
    setCardStyleKey(key);
    SecureStore.setItemAsync(CARD_STYLE_KEY, key).catch(() => {});
    setFlipped(false);
    Animated.timing(flipAnim, { toValue: 0, duration: 480, useNativeDriver: true }).start();
  };

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backRotate = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });
  const navigation = useNavigation();
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("ARS");
  const [visible, setVisible] = useState(true);
  const [cardSize, setCardSize] = useState({ w: 0, h: 0 });
  const [modalMode, setModalMode] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [resumenTab, setResumenTab] = useState("resumen"); // resumen | historial
  const [expandedMovs, setExpandedMovs] = useState(() => new Set()); // filas abiertas
  const [editMov, setEditMov] = useState(null); // movimiento a editar (form)
  const [infoOpen, setInfoOpen] = useState(false); // popup "cómo funciona"

  const toggleMovExpand = (id) =>
    setExpandedMovs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleDeleteMov = (mov) =>
    Alert.alert("Eliminar movimiento", `¿Borrar "${mov.categoria || "movimiento"}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await movimientoService.delete(mov._id);
            fetchData();
          } catch {
            Alert.alert("Error", "No se pudo eliminar.");
          }
        },
      },
    ]);
  const [saldoInfoOpen, setSaldoInfoOpen] = useState(false); // popup info del saldo total
  const [typeCurrency, setTypeCurrency] = useState("ARS"); // ARS/USD dentro de Deuda/Ahorro

  const isCurrency = tab === "ARS" || tab === "USD";
  const currency = isCurrency ? tab : "ARS";
  const currencyTag = currency === "USD" ? "US$" : "AR$";

  const goToFilter = (tipo) =>
    navigation.navigate("Filtros", { tipo: tipo || "all", currency, nonce: Date.now() });

  const fetchData = useCallback(async () => {
    setError("");
    try {
      const res = await movimientoService.getAll();
      setMovimientos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError("No se pudieron cargar los movimientos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { historical, monthSummary, monthCount, monthMovs } = useMemo(() => {
    const byCurrency = filterMovimientosByCurrency(movimientos, currency);
    const mm = byCurrency
      .filter((m) => isSameMonth(m.fecha))
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    return {
      historical: summarizeByType(byCurrency),
      monthSummary: summarizeByType(mm),
      monthCount: mm.length,
      monthMovs: mm,
    };
  }, [movimientos, currency]);

  // Movimientos del tipo activo (deuda / ahorro), más recientes primero.
  // En Ahorros entran también los usos (egresos pagados con ahorro).
  const typeMovs = useMemo(() => {
    if (isCurrency) return [];
    return movimientos
      .filter((m) => (tab === "ahorro" ? m.tipo === "ahorro" || m.desdeAhorro : m.tipo === tab))
      .filter((m) => (m.moneda === "USD" ? "USD" : "ARS") === typeCurrency)
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  }, [movimientos, tab, isCurrency, typeCurrency]);

  // Ahorro disponible por moneda (ahorrado - usado)
  const savingsPot = useMemo(() => {
    const pot = { ARS: 0, USD: 0 };
    movimientos.forEach((m) => {
      const cur = m.moneda === "USD" ? "USD" : "ARS";
      const amount = Number(m.monto) || 0;
      if (m.tipo === "ahorro") pot[cur] += amount;
      else if (m.desdeAhorro) pot[cur] -= amount;
    });
    return pot;
  }, [movimientos]);

  // Serie del sparkline: saldo acumulado día a día (últimos 30 días, cortado en hoy),
  // con la misma cuenta que el saldo total (ingresos - egresos - ahorros).
  const sparkSerie = useMemo(() => {
    const byCurrency = filterMovimientosByCurrency(movimientos, currency);
    const delta = (m) => {
      const amount = Number(m.monto) || 0;
      if (m.tipo === "ingreso") return amount;
      if (m.tipo === "ahorro") return -amount;
      if (m.tipo === "deuda" || m.desdeAhorro) return 0;
      return -amount; // egreso
    };
    const hoy = new Date();
    const dayKey = (d) => d.toISOString().slice(0, 10);
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - 29);
    const inicioKey = dayKey(inicio);
    let base = 0;
    const porDia = {};
    byCurrency.forEach((m) => {
      const k = String(m.fecha || "").slice(0, 10);
      if (!k) return;
      if (k < inicioKey) base += delta(m);
      else porDia[k] = (porDia[k] || 0) + delta(m);
    });
    const serie = [];
    let acc = base;
    for (let i = 0; i < 30; i++) {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      acc += porDia[dayKey(d)] || 0;
      serie.push(acc);
    }
    // Recorta el arranque muerto: si los primeros días son todos iguales
    // (sin movimientos), empieza un día antes del primer cambio para que
    // se vea la progresión y no una línea plana.
    const primerCambio = serie.findIndex((v) => v !== serie[0]);
    if (primerCambio > 1) return serie.slice(primerCambio - 1);
    return serie;
  }, [movimientos, currency]);

  const currencyMeta = getCurrencyMeta(currency);
  const money = (amount) => (visible ? formatMoney(amount, currency) : "••••");
  const moneyOf = (amount, mon) => (visible ? formatMoney(amount, mon || "ARS") : "••••");

  // Acciones de la card, como en el Figma: flecha verde ↓, flecha roja ↑,
  // fijo = flecha + candado / reloj.
  const quickActions = [
    { key: "ingreso", label: "Ingreso", icon: "arrow-down", color: VERDE },
    { key: "egreso", label: "Egreso", icon: "arrow-up", color: ROJO },
    { key: "ingreso-fijo", label: "Ingreso fijo", icon: "arrow-down", extra: "lock-closed", color: VERDE },
    { key: "egreso-fijo", label: "Gasto fijo", icon: "arrow-up", extra: "time-outline", color: ROJO },
  ];

  // Filas del resumen en el orden del Figma (Movimientos al final)
  const stats = [
    { label: "Resultado mensual", value: money(monthSummary.total), accent: ACCENTS.resultado, tipo: null },
    { label: "Ingresos del mes", value: money(monthSummary.ingreso), accent: ACCENTS.ingreso, tipo: "ingreso" },
    { label: "Egresos del mes", value: money(monthSummary.egreso), accent: ACCENTS.egreso, tipo: "egreso" },
    { label: "Ahorro del mes", value: money(monthSummary.ahorro), accent: ACCENTS.ahorro, tipo: "ahorro" },
    { label: "Deuda pendiente", value: money(historical.deudaPendiente), accent: ACCENTS.deuda, tipo: "deuda" },
    { label: "Movimientos del mes", value: visible ? String(monthCount) : "••", accent: ACCENTS.movimientos, tipo: null },
  ];

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: BG }} />;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={fetchData} tintColor={VERDE} />
        }
      >
        {/* Contenedor redondeado de tabs (borde gris). Con moneda activa, la card
            de saldo lo tapa desde la mitad, igual que en el Figma. */}
        <View style={[styles.tabsShell, !isCurrency && styles.tabsShellSolo]}>
          <View style={styles.segmentRow}>
            {HOME_TABS.map((t) => {
              const active = t.key === tab;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.segment, active && styles.segmentActive]}
                  onPress={() => setTab(t.key)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {isCurrency ? <View style={{ height: 186 * u }} /> : null}
        </View>

        <View style={styles.cardBody}>
            {isCurrency ? (
              <>
                {/* Tarjeta de saldo (degradado gris del Figma; se da vuelta con la paleta) */}
                <View style={[styles.flipWrap, { marginTop: -177 * u }]}>
                <Animated.View
                  style={[
                    styles.balanceCard,
                    { backgroundColor: card.backup },
                    { transform: [{ perspective: 1000 }, { rotateY: frontRotate }], backfaceVisibility: "hidden" },
                  ]}
                  onLayout={(e) =>
                    setCardSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
                  }
                >
                  {cardSize.w > 0 ? (
                    <>
                      <Svg width={cardSize.w} height={cardSize.h} style={StyleSheet.absoluteFill}>
                        <Defs>
                          <LinearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0" stopColor={card.stops[0]} />
                            <Stop offset="0.5" stopColor={card.stops[1]} />
                            <Stop offset="1" stopColor={card.stops[2]} />
                          </LinearGradient>
                        </Defs>
                        <Rect width={cardSize.w} height={cardSize.h} rx={34 * u} fill="url(#cardGrad)" />
                      </Svg>

                      {/* Brillo diagonal que se desliza */}
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          StyleSheet.absoluteFill,
                          {
                            transform: [
                              {
                                translateX: sheen.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [-(cardSize.w || 300), cardSize.w || 300],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <Svg width={cardSize.w} height={cardSize.h}>
                          <Defs>
                            <LinearGradient id="cardSheen" x1="0" y1="0" x2="1" y2="0.55">
                              <Stop offset="0.36" stopColor="#ffffff" stopOpacity="0" />
                              <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0.5" />
                              <Stop offset="0.64" stopColor="#ffffff" stopOpacity="0" />
                            </LinearGradient>
                          </Defs>
                          <Rect width={cardSize.w} height={cardSize.h} fill="url(#cardSheen)" />
                        </Svg>
                      </Animated.View>
                    </>
                  ) : null}

                  <View style={styles.bcTop}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.bcKickerRow}>
                        <Text style={[styles.bcKicker, { color: card.text }]}>Saldo total</Text>
                        <TouchableOpacity onPress={() => setSaldoInfoOpen(true)} hitSlop={8}>
                          <Ionicons name="information-circle-outline" size={23 * u} color={card.text} />
                        </TouchableOpacity>
                      </View>
                      {loading ? (
                        <ActivityIndicator
                          color={card.text}
                          style={{ alignSelf: "flex-start", marginVertical: 14 * u }}
                        />
                      ) : (
                        <Text
                          style={[styles.bcBalance, { color: card.text }]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.55}
                        >
                          {money(historical.total)}
                        </Text>
                      )}
                    </View>

                    {/* Historial · Ojo · Paleta (círculos grises del Figma) */}
                    <View style={styles.bcIcons}>
                      <TouchableOpacity
                        style={styles.bcIconBtn}
                        onPress={() => setShowHistory(true)}
                        hitSlop={6}
                      >
                        <MaterialCommunityIcons name="history" size={25 * u} color={BG} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.bcIconBtn}
                        onPress={() => setVisible((v) => !v)}
                        hitSlop={6}
                      >
                        <Ionicons
                          name={visible ? "eye-outline" : "eye-off-outline"}
                          size={25 * u}
                          color={BG}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.bcIconBtn} onPress={flipCard} hitSlop={6}>
                        <Ionicons name="color-palette-outline" size={25 * u} color={BG} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Sparkline del saldo dentro de la tarjeta (formato del mockup) */}
                  <View style={styles.bcSparkWrap}>
                    {cardSize.w > 0 && visible ? (
                      <BalanceSpark
                        serie={sparkSerie}
                        width={cardSize.w - 72 * u}
                        height={70 * u}
                        color={card.text}
                        fillColor={card.glow3}
                      />
                    ) : null}
                  </View>
                </Animated.View>

                {/* Dorso de la tarjeta: elegir color */}
                <Animated.View
                  pointerEvents={flipped ? "auto" : "none"}
                  style={[
                    styles.balanceCard,
                    styles.cardBack,
                    StyleSheet.absoluteFill,
                    { transform: [{ perspective: 1000 }, { rotateY: backRotate }], backfaceVisibility: "hidden" },
                  ]}
                >
                  <Text style={styles.cardBackTitle}>Elegí un color de tarjeta</Text>
                  <View style={styles.swatchRow}>
                    {CARD_ORDER.map((k) => (
                      <TouchableOpacity
                        key={k}
                        onPress={() => chooseCard(k)}
                        activeOpacity={0.8}
                        style={[
                          styles.swatch,
                          { backgroundColor: CARD_STYLES[k].swatch },
                          cardStyleKey === k && styles.swatchActive,
                        ]}
                      >
                        {cardStyleKey === k ? <Ionicons name="checkmark" size={18} color="#0e1a0e" /> : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.cardBackDone} onPress={flipCard}>
                    <Text style={styles.cardBackDoneText}>Listo</Text>
                  </TouchableOpacity>
                </Animated.View>
                </View>

                {/* Acciones rápidas: círculos con barrita de color (formato del mockup) */}
                <View style={styles.quickRow}>
                  {quickActions.map((a) => (
                    <TouchableOpacity
                      key={a.key}
                      style={styles.quickItem}
                      onPress={() => setModalMode(a.key)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.quickCircle, { backgroundColor: a.color + "1c", borderColor: a.color + "55" }]}>
                        <Ionicons name={a.icon} size={27 * u} color={a.color} />
                        {a.extra ? (
                          <Ionicons name={a.extra} size={16 * u} color={a.color} style={styles.quickExtra} />
                        ) : null}
                      </View>
                      <Text style={styles.quickLabel} numberOfLines={1}>
                        {a.label}
                      </Text>
                      <View style={[styles.quickBar, { backgroundColor: a.color }]} />
                    </TouchableOpacity>
                  ))}
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                {/* ===== Ticket con borde verde: Resumen / Historial ===== */}
                <View style={styles.ticket}>
                  <View style={styles.ticketSwitchRow}>
                    <View style={styles.ticketSwitch}>
                      {[
                        ["resumen", "Resumen"],
                        ["historial", "Historial"],
                      ].map(([k, l]) => (
                        <TouchableOpacity
                          key={k}
                          style={[styles.ticketSeg, resumenTab === k && styles.ticketSegOn]}
                          onPress={() => setResumenTab(k)}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.ticketSegText, resumenTab === k && styles.ticketSegTextOn]}>{l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  {resumenTab === "historial" ? (
                    <TouchableOpacity onPress={() => setShowHistory(true)} hitSlop={8} style={styles.verTodosWrap}>
                      <Text style={styles.verTodos}>Ver todos</Text>
                    </TouchableOpacity>
                  ) : null}

                  {resumenTab === "resumen" ? (
                    <View style={styles.ticketBody}>
                      {/* Dos cajas con borde, como el mockup: 4 filas del mes y aparte deuda + movimientos */}
                      {[stats.slice(0, 4), stats.slice(4)].map((grupo, gi) => (
                        <View key={gi} style={styles.resGroup}>
                          {grupo.map((s, i) => (
                            <TouchableOpacity
                              key={s.label}
                              style={[styles.ticketRow, i > 0 && styles.ticketRowDivider]}
                              activeOpacity={0.6}
                              onPress={() => goToFilter(s.tipo)}
                            >
                              <Text style={styles.ticketLabel} numberOfLines={1}>
                                {s.label}
                              </Text>
                              <Text style={[styles.ticketValue, { color: s.accent }]}>{s.value}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={[styles.ticketBody, styles.resGroup, styles.resGroupPad]}>
                      {monthMovs.length === 0 ? (
                        <Text style={styles.movEmpty}>No hay movimientos este mes.</Text>
                      ) : (
                        monthMovs.map((item, idx) => {
                          const meta = getMovementTypeMeta(item.tipo);
                          const abierto = expandedMovs.has(item._id);
                          const isDebt = item.tipo === "deuda";
                          const isPendingDebt = isDebt && item.deudaEstado !== "pagada";
                          const debtPaid = Number(item.deudaPagado) || 0;
                          const debtRemaining = (Number(item.monto) || 0) - debtPaid;
                          const isPartialDebt = isPendingDebt && debtPaid > 0;
                          return (
                            <View
                              key={item._id}
                              style={[styles.movTkItem, idx < monthMovs.length - 1 && styles.movTkDivider]}
                            >
                              <TouchableOpacity
                                style={styles.movTkTop}
                                activeOpacity={0.7}
                                onPress={() => toggleMovExpand(item._id)}
                              >
                                <View style={[styles.movRedIcon, { borderColor: meta.color + "55", backgroundColor: meta.color + "1f" }]}>
                                  <Ionicons name={movementIcon(item)} size={17} color={TXT} />
                                </View>
                                <Text style={styles.movRedTitle} numberOfLines={1}>
                                  {item.categoria || "Sin categoría"}
                                </Text>
                                <Text style={[styles.movRedAmount, { color: meta.color }]}>
                                  {visible ? formatSignedMoney(item.monto, currency, item.tipo) : "••••"}
                                </Text>
                                <Ionicons
                                  name={abierto ? "chevron-up" : "chevron-down"}
                                  size={18}
                                  color={MUTED}
                                  style={{ marginLeft: 6 }}
                                />
                              </TouchableOpacity>

                              {abierto ? (
                                <View style={styles.movTkBody}>
                                  <Text style={styles.movRedFecha}>{fmtDate(item.fecha)}</Text>
                                  {item.detalle ? <Text style={styles.movRedDetail}>{item.detalle}</Text> : null}
                                  {isDebt && item.deudaAcreedor ? (
                                    <Text style={styles.movRedDetail}>Acreedor: {item.deudaAcreedor}</Text>
                                  ) : null}
                                  {isPendingDebt ? (
                                    <Text style={styles.movRedDebt}>
                                      {isPartialDebt
                                        ? `Pagado ${formatMoney(debtPaid, currency)} · resta ${formatMoney(debtRemaining, currency)}`
                                        : "Pendiente de pago"}
                                    </Text>
                                  ) : null}
                                  <View style={styles.movRedChips}>
                                    <Text style={[styles.movRedChip, { color: meta.color }]}>{meta.label}</Text>
                                    {isPartialDebt ? (
                                      <Text style={[styles.movRedChip, { color: VERDE }]}>Parcial</Text>
                                    ) : null}
                                    {item.desdeAhorro ? (
                                      <Text style={[styles.movRedChip, { color: "#4fb6c9" }]}>Uso de ahorro</Text>
                                    ) : null}
                                    {item.medio ? <Text style={styles.movRedChip}>{item.medio}</Text> : null}
                                  </View>
                                  <View style={styles.movRedActions}>
                                    {isPendingDebt ? (
                                      <TouchableOpacity style={styles.movRedPay} onPress={() => setShowHistory(true)}>
                                        <Ionicons name="cash-outline" size={15} color="#3a2d05" />
                                        <Text style={styles.movRedPayText}>Pagar deuda</Text>
                                      </TouchableOpacity>
                                    ) : (
                                      <View />
                                    )}
                                    <View style={styles.movRedIcons}>
                                      <TouchableOpacity onPress={() => setEditMov(item)} hitSlop={8}>
                                        <Ionicons name="pencil" size={18} color={MUTED} />
                                      </TouchableOpacity>
                                      <TouchableOpacity onPress={() => handleDeleteMov(item)} hitSlop={8}>
                                        <Ionicons name="trash-outline" size={18} color="#ff6b5e" />
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                </View>
                              ) : null}
                            </View>
                          );
                        })
                      )}
                    </View>
                  )}

                  {/* Footer en su propia caja, como el mockup */}
                  <View style={styles.footBox}>
                    <Text style={styles.ticketGracias}>Gracias por utilizar GROWTH MANAGER</Text>
                    <Text style={styles.ticketWeb}>
                      Utiliza la version web{"\n"}
                      <Text style={styles.ticketWebLink}>www.growthmanager.app</Text>
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={styles.typeHeaderRow}>
                  <View style={styles.balanceLabelRow}>
                    <Text style={styles.balanceLabel}>{tab === "deuda" ? "Deudas" : "Ahorros"}</Text>
                    <TouchableOpacity
                      style={styles.infoBtn}
                      onPress={() => setInfoOpen(true)}
                      hitSlop={8}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="information-circle-outline" size={19} color={MUTED} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.typeHeaderRight}>
                    {/* Sub-switch ARS/USD para separar deuda/ahorro por moneda */}
                    <View style={styles.curSwitch}>
                      {["ARS", "USD"].map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={[styles.curSwitchBtn, typeCurrency === c && styles.curSwitchBtnActive]}
                          onPress={() => setTypeCurrency(c)}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.curSwitchText,
                              typeCurrency === c && styles.curSwitchTextActive,
                            ]}
                          >
                            {c}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => setVisible((v) => !v)} hitSlop={6}>
                      <Ionicons
                        name={visible ? "eye-outline" : "eye-off-outline"}
                        size={19}
                        color={TXT}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                {tab === "ahorro" ? (
                  <Text style={styles.potText}>
                    Disponible:{" "}
                    {visible ? formatMoney(savingsPot[typeCurrency], typeCurrency) : "••••"}
                  </Text>
                ) : (
                  <Text style={styles.balanceSub}>
                    {typeMovs.length} {typeMovs.length === 1 ? "movimiento" : "movimientos"} en{" "}
                    {typeCurrency}
                  </Text>
                )}

                {/* Botones del tipo activo */}
                <View style={styles.typeBtnRow}>
                  <TouchableOpacity
                    style={[styles.addTypeBtn, { backgroundColor: tab === "deuda" ? "#f4c622" : "#2bb888" }]}
                    onPress={() => setModalMode(tab)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name={tab === "deuda" ? "person-outline" : "wallet-outline"} size={18} color={tab === "deuda" ? "#3a2d05" : "#fff"} />
                    <Text style={[styles.addTypeText, tab === "deuda" && { color: "#3a2d05" }]}>
                      {tab === "deuda" ? "Cargar deuda" : "Nuevo ahorro"}
                    </Text>
                  </TouchableOpacity>

                  {tab === "ahorro" ? (
                    <TouchableOpacity
                      style={styles.useTypeBtn}
                      onPress={() => setModalMode("ahorro-uso")}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="cart-outline" size={18} color="#2bb888" />
                      <Text style={styles.useTypeText}>Usar ahorro</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <Text style={styles.sectionLabel}>Movimientos</Text>
                {loading ? (
                  <ActivityIndicator color={VERDE} style={{ alignSelf: "flex-start", marginTop: 6 }} />
                ) : error ? (
                  <Text style={styles.error}>{error}</Text>
                ) : typeMovs.length === 0 ? (
                  <Text style={styles.emptyText}>
                    No hay {tab === "deuda" ? "deudas" : "ahorros"} en {typeCurrency} todavía.
                  </Text>
                ) : (
                  <View style={styles.statGrid}>
                    {typeMovs.map((m) => {
                      const isPaid = m.tipo === "deuda" && m.deudaEstado === "pagada";
                      const isPartial =
                        m.tipo === "deuda" && !isPaid && Number(m.deudaPagado) > 0;
                      return (
                        <TouchableOpacity
                          key={m._id}
                          style={styles.movRow}
                          activeOpacity={0.7}
                          onPress={() => goToFilter(tab)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.movTitle} numberOfLines={1}>
                              {m.categoria || "Sin categoría"}
                            </Text>
                            {m.deudaAcreedor ? (
                              <Text style={styles.movSub} numberOfLines={1}>
                                Acreedor: {m.deudaAcreedor}
                              </Text>
                            ) : m.detalle ? (
                              <Text style={styles.movSub} numberOfLines={1}>
                                {m.detalle}
                              </Text>
                            ) : null}
                            <View style={styles.movMetaRow}>
                              <Text style={styles.movDate}>{fmtDate(m.fecha)}</Text>
                              {m.tipo === "deuda" ? (
                                <Text
                                  style={[
                                    styles.movChip,
                                    { color: isPaid ? VERDE : isPartial ? VERDE : "#f4c622" },
                                  ]}
                                >
                                  {isPaid ? "Pagada" : isPartial ? "Parcial" : "Pendiente"}
                                </Text>
                              ) : null}
                              {m.desdeAhorro ? (
                                <Text style={[styles.movChip, { color: "#4fb6c9" }]}>Uso de ahorro</Text>
                              ) : null}
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.movAmount,
                              { color: m.tipo === "deuda" ? "#f4c622" : "#35cfa4" },
                            ]}
                          >
                            {m.desdeAhorro ? "- " : ""}
                            {moneyOf(m.monto, m.moneda)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </View>
      </ScrollView>

      <MovementFormModal
        visible={Boolean(modalMode)}
        modeKey={modalMode}
        defaultCurrency={currency}
        movimientos={movimientos}
        onClose={() => setModalMode(null)}
        onSaved={fetchData}
      />

      <MovementFormModal
        visible={Boolean(editMov)}
        editMovement={editMov}
        defaultCurrency={currency}
        movimientos={movimientos}
        onClose={() => setEditMov(null)}
        onSaved={() => {
          setEditMov(null);
          fetchData();
        }}
      />

      <HistoryModal
        visible={showHistory}
        movimientos={movimientos}
        currency={currency}
        onClose={() => setShowHistory(false)}
        onChanged={fetchData}
      />

      <Modal
        visible={infoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoOpen(false)}
      >
        <TouchableOpacity
          style={styles.infoOverlay}
          activeOpacity={1}
          onPress={() => setInfoOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.infoCard}>
            <View style={styles.infoHead}>
              <Text style={styles.infoTitle}>
                {tab === "deuda" ? "Cómo funcionan las deudas" : "Cómo funcionan los ahorros"}
              </Text>
              <TouchableOpacity onPress={() => setInfoOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={VERDE} />
              </TouchableOpacity>
            </View>

            {tab === "deuda" ? (
              <View style={styles.infoBody}>
                <Text style={styles.infoText}>
                  Las deudas son plata que te deben o que tenés que pagar, y se llevan aparte del
                  saldo.
                </Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoStrong}>Cargar deuda:</Text> anotás lo pendiente. Queda en
                  “Deuda pendiente” y todavía no mueve tu saldo.
                </Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoStrong}>Cuando se cobra/paga:</Text> registrás el pago
                  (total o parcial) y recién ahí impacta como ingreso o egreso en tu saldo.
                </Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoStrong}>Pago parcial:</Text> podés ir descontando de a
                  poco; la deuda muestra cuánto queda.
                </Text>
                <Text style={styles.infoTip}>
                  Idea: usá deudas para lo que está “en el aire” y no ensucia tu saldo real hasta
                  que se concreta.
                </Text>
              </View>
            ) : (
              <View style={styles.infoBody}>
                <Text style={styles.infoText}>
                  El ahorro es una “bolsita” aparte que sale de tu saldo. Así funciona el flujo
                  real:
                </Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoStrong}>1. Cargás saldo:</Text> primero registrás tus
                  ingresos (tu plata disponible del mes).
                </Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoStrong}>2. Nuevo ahorro:</Text> al guardarlo, ese monto se
                  descuenta de tu saldo y se guarda en la bolsita de Ahorros.
                </Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoStrong}>3. Usar ahorro:</Text> cuando gastás desde el
                  ahorro, se descuenta solo de la bolsita de Ahorros, no de tu saldo del mes.
                </Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoStrong}>4. Tope:</Text> no podés usar más ahorro del que
                  tenés disponible; si querés seguir, primero cargás más ahorro.
                </Text>
                <Text style={styles.infoTip}>
                  En resumen: ahorrar mueve plata del saldo → a la bolsita. Usar ahorro gasta de la
                  bolsita, sin tocar el saldo del mes.
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.infoOk} onPress={() => setInfoOpen(false)}>
              <Text style={styles.infoOkText}>Entendido</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={saldoInfoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSaldoInfoOpen(false)}
      >
        <TouchableOpacity
          style={styles.infoOverlay}
          activeOpacity={1}
          onPress={() => setSaldoInfoOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.infoCard}>
            <View style={styles.infoHead}>
              <Text style={styles.infoTitle}>Saldo total</Text>
              <TouchableOpacity onPress={() => setSaldoInfoOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={VERDE} />
              </TouchableOpacity>
            </View>

            <View style={styles.infoBody}>
              <Text style={styles.infoText}>
                El saldo total es la <Text style={styles.infoStrong}>diferencia entre tus
                ingresos y tus egresos</Text>.
              </Text>
              <Text style={styles.infoText}>
                Incluye todo junto: lo que movés en{" "}
                <Text style={styles.infoStrong}>efectivo</Text> y en{" "}
                <Text style={styles.infoStrong}>transferencia</Text>.
              </Text>
              <View style={styles.saldoTip}>
                <Ionicons name="funnel-outline" size={16} color={VERDE} />
                <Text style={styles.saldoTipText}>
                  ¿Querés ver cuánto es en efectivo y cuánto en transferencia por separado?
                  Buscalo en Filtros, en la barra de abajo: cada movimiento muestra su medio.
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.infoOk} onPress={() => setSaldoInfoOpen(false)}>
              <Text style={styles.infoOkText}>Entendido</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (u) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 28 },

  // Contenedor redondeado de los tabs (borde gris, radio 34 del Figma).
  // Con moneda activa lleva un espaciador que después tapa la card (overlap).
  tabsShell: {
    borderWidth: 2,
    borderColor: GRIS_BORDE,
    borderRadius: 34 * u,
    paddingTop: 10 * u,
    paddingHorizontal: 14 * u,
  },
  tabsShellSolo: { paddingBottom: 10 * u },
  segmentRow: { flexDirection: "row", alignItems: "center" },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8 * u,
    borderRadius: 15 * u,
  },
  segmentActive: { backgroundColor: GRIS_PILL },
  segmentText: { fontFamily: "Menda-Medium", fontSize: 25 * u, letterSpacing: -1 * u, color: TXT },
  segmentTextActive: { fontFamily: "Menda-Bold", color: "#000000" },

  sectionLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 10,
  },

  cardBody: { position: "relative", paddingTop: 2, paddingBottom: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: LINEA,
    alignItems: "center",
    justifyContent: "center",
  },
  typeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  typeHeaderRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  balanceLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  balanceLabel: {
    fontFamily: "Menda-Bold",
    color: TXT,
    fontSize: 22 * u,
    letterSpacing: -1 * u,
  },
  infoBtn: { padding: 1 },
  curSwitch: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LINEA,
    padding: 2,
  },
  curSwitchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  curSwitchBtnActive: { backgroundColor: VERDE },
  curSwitchText: { color: MUTED, fontWeight: "800", fontSize: 12 },
  curSwitchTextActive: { color: "#000000" },
  infoOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: 22,
  },
  infoCard: {
    backgroundColor: BG,
    borderRadius: 22 * u,
    borderWidth: 1,
    borderColor: VERDE,
    padding: 18,
  },
  infoHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  infoTitle: { fontFamily: "Menda-Bold", color: TXT, fontSize: 16, flex: 1 },
  infoBody: { gap: 10 },
  infoText: { color: "rgba(255,255,255,0.8)", fontSize: 14, lineHeight: 21 },
  infoStrong: { color: TXT, fontWeight: "800" },
  infoTip: {
    color: TXT,
    fontSize: 13.5,
    lineHeight: 20,
    backgroundColor: "rgba(117, 249, 76, 0.12)",
    borderRadius: 12,
    padding: 12,
    marginTop: 2,
    overflow: "hidden",
  },
  saldoTip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(117, 249, 76, 0.12)",
    borderRadius: 12,
    padding: 12,
    marginTop: 2,
  },
  saldoTipText: { flex: 1, color: TXT, fontSize: 13.5, lineHeight: 20 },
  infoOk: {
    marginTop: 18,
    alignSelf: "flex-end",
    backgroundColor: VERDE,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  infoOkText: { color: "#000000", fontWeight: "800", fontSize: 14 },
  error: { color: "#ff6b5e", marginTop: 8 },

  // ===== Tarjeta de saldo (degradado gris del Figma) =====
  flipWrap: { position: "relative" },
  balanceCard: {
    borderRadius: 34 * u,
    paddingTop: 34 * u,
    paddingBottom: 30 * u,
    paddingHorizontal: 36 * u,
    minHeight: 272 * u,
    justifyContent: "space-between",
    overflow: "hidden",
    backgroundColor: "#4f4f4f", // respaldo hasta que el SVG mida la tarjeta
  },
  cardBack: {
    backgroundColor: "#1a201a",
    borderWidth: 1,
    borderColor: LINEA,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingVertical: 26,
  },
  cardBackTitle: { fontFamily: "Menda-Bold", color: TXT, fontSize: 13 },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  swatchActive: { borderColor: VERDE, borderWidth: 3 },
  cardBackDone: {
    backgroundColor: VERDE,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  cardBackDoneText: { color: "#000000", fontWeight: "800", fontSize: 13 },
  bcTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  bcKickerRow: { flexDirection: "row", alignItems: "center", gap: 8 * u },
  bcKicker: {
    fontFamily: "Menda-Medium",
    fontSize: 22 * u,
    letterSpacing: -1 * u,
  },
  bcIcons: { flexDirection: "row", gap: 4 * u },
  bcIconBtn: {
    width: 45 * u,
    height: 45 * u,
    borderRadius: 23 * u,
    backgroundColor: "#d9d9d9",
    alignItems: "center",
    justifyContent: "center",
  },
  bcBalance: {
    fontFamily: "Menda-Bold",
    fontSize: 37 * u,
    letterSpacing: -1.5 * u,
    marginTop: 6 * u,
    fontVariant: ["tabular-nums"],
  },

  // Sparkline dentro de la tarjeta
  bcSparkWrap: { marginTop: 18 * u, minHeight: 70 * u, justifyContent: "flex-end" },

  // Acciones rápidas: 4 tiles con borde (mockup 3), cada uno con círculo,
  // etiqueta y barrita de color abajo
  quickRow: { flexDirection: "row", alignItems: "stretch", marginTop: 26 * u, gap: 10 * u },
  quickItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8 * u,
    borderWidth: 1,
    borderColor: LINEA,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 18 * u,
    paddingVertical: 14 * u,
    paddingHorizontal: 4 * u,
  },
  quickCircle: {
    width: 50 * u,
    height: 50 * u,
    borderRadius: 25 * u,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  quickExtra: { marginLeft: -3 * u, marginBottom: -10 * u },
  quickLabel: { fontFamily: "Menda-Medium", fontSize: 13 * u, letterSpacing: -0.5 * u, color: TXT },
  quickBar: { width: "62%", height: 5 * u, borderRadius: 3 * u },

  statGrid: { gap: 10 },

  // ---- Resumen/Historial en formato abierto (mockup): pastillas + lista sin marco ----
  ticket: {
    paddingHorizontal: 4 * u,
    paddingTop: 6 * u,
    paddingBottom: 10 * u,
    marginTop: 30 * u,
  },
  // Switch Resumen/Historial: contenedor cuadrado a la derecha (mockup 3)
  ticketSwitchRow: { alignItems: "flex-end" },
  ticketSwitch: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: LINEA,
    borderRadius: 14 * u,
    padding: 4 * u,
    gap: 4 * u,
  },
  ticketSeg: {
    paddingVertical: 8 * u,
    paddingHorizontal: 26 * u,
    borderRadius: 10 * u,
    alignItems: "center",
  },
  ticketSegOn: { backgroundColor: VERDE },
  ticketSegText: { fontFamily: "Menda-Medium", fontSize: 25 * u, letterSpacing: -1 * u, color: TXT },
  ticketSegTextOn: { color: "#000000" },
  verTodosWrap: { alignSelf: "flex-end", marginTop: 10 * u, marginRight: 8 * u },
  verTodos: { fontFamily: "Menda-Medium", color: VERDE, fontSize: 18 * u },

  ticketBody: { marginTop: 18 * u, gap: 14 * u },
  // Caja con borde que agrupa filas (mockup 3)
  resGroup: {
    borderWidth: 1,
    borderColor: LINEA,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 18 * u,
    overflow: "hidden",
  },
  resGroupPad: { paddingHorizontal: 14 * u, paddingVertical: 4 * u },
  ticketRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11 * u,
    paddingHorizontal: 18 * u,
  },
  ticketRowDivider: { borderTopWidth: 1, borderColor: LINEA },
  ticketLabel: {
    fontFamily: "Menda-Medium",
    fontSize: 18 * u,
    letterSpacing: -0.6 * u,
    color: TXT,
    flexShrink: 1,
    marginRight: 12 * u,
  },
  ticketValue: {
    fontFamily: "Menda-Bold",
    fontSize: 18 * u,
    letterSpacing: -0.6 * u,
    fontVariant: ["tabular-nums"],
  },

  // Footer en su propia caja
  footBox: {
    borderWidth: 1,
    borderColor: LINEA,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 18 * u,
    paddingVertical: 18 * u,
    paddingHorizontal: 14 * u,
    marginTop: 14 * u,
  },
  ticketGracias: {
    fontFamily: "Menda-Medium",
    fontSize: 16 * u,
    letterSpacing: -0.6 * u,
    color: TXT,
    textAlign: "center",
  },
  ticketWeb: {
    fontFamily: "Menda-Medium",
    fontSize: 21 * u,
    lineHeight: 27 * u,
    letterSpacing: -1 * u,
    color: TXT,
    textAlign: "center",
    marginTop: 10 * u,
  },
  ticketWebLink: { color: VERDE },

  // ---- Historial reducido dentro del ticket ----
  movEmpty: { color: MUTED, fontSize: 13, textAlign: "center", paddingVertical: 22 },
  movTkItem: {},
  movTkDivider: { borderBottomWidth: 1, borderColor: LINEA },
  movTkTop: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  movTkBody: { paddingBottom: 12, paddingTop: 2, gap: 4 },
  movRedIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  movRedTitle: { flex: 1, color: TXT, fontSize: 14.5, fontWeight: "700" },
  movRedAmount: { fontSize: 14.5, fontWeight: "800", fontVariant: ["tabular-nums"] },
  movRedFecha: { color: MUTED, fontSize: 12, fontWeight: "700" },
  movRedDetail: { color: MUTED, fontSize: 13 },
  movRedDebt: { color: VERDE, fontSize: 13, fontWeight: "700" },
  movRedChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  movRedChip: { color: MUTED, fontSize: 11.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  movRedPay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: "#f4c622",
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  movRedPayText: { color: "#3a2d05", fontSize: 13, fontWeight: "800" },
  movRedActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  movRedIcons: { flexDirection: "row", alignItems: "center", gap: 18 },

  balanceSub: { color: MUTED, fontSize: 13, marginTop: 6 },
  potText: { color: "#2bb888", fontSize: 14, fontWeight: "800", marginTop: 6 },
  typeBtnRow: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  addTypeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  addTypeText: { color: "#fff", fontWeight: "700", fontSize: 12.5 },
  useTypeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#2bb888",
    backgroundColor: "rgba(43, 184, 136, 0.12)",
  },
  useTypeText: { color: "#2bb888", fontWeight: "800", fontSize: 12.5 },
  emptyText: { color: MUTED, fontSize: 14, marginTop: 4 },
  movRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: LINEA,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  movTitle: { color: TXT, fontSize: 14, fontWeight: "700" },
  movSub: { color: MUTED, fontSize: 12, marginTop: 2 },
  movMetaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  movDate: { color: MUTED, fontSize: 11 },
  movChip: { fontSize: 11, fontWeight: "800" },
  movAmount: { color: TXT, fontSize: 15, fontWeight: "800" },
});
