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
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import * as SecureStore from "expo-secure-store";
import { movimientoService } from "../api";
import { useTheme } from "../theme";
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

// Acentos fijos; el resto de la paleta sigue el tema claro/oscuro
const VERDE = "#75f94c";
const ROJO = "#eb3223";

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
  const { colors: tema, isDark } = useTheme();
  // Paleta derivada del tema: en oscuro conserva el look del rediseño
  const pal = useMemo(
    () => ({
      bg: tema.bg,
      txt: tema.text,
      muted: tema.muted,
      linea: tema.cardBorder,
      tabBorder: isDark ? "#4e4e4e" : "rgba(22, 41, 31, 0.25)",
      pillBg: isDark ? "#4f4f4f" : "#16241d",
      pillText: isDark ? "#000000" : "#ffffff",
      panelBg: isDark ? "rgba(255,255,255,0.03)" : tema.card,
      panelBg2: isDark ? "rgba(255,255,255,0.06)" : tema.cardSoft,
      rowBg: isDark ? "rgba(255,255,255,0.05)" : tema.card,
      verdeTexto: isDark ? VERDE : tema.greenDark,
      cardBackBg: isDark ? "#0d2430" : tema.card,
    }),
    [tema, isDark]
  );
  const styles = useMemo(() => makeStyles(u, pal), [u, pal]);
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

  const { historical, monthSummary, monthCount, monthMovs, prevSummary } = useMemo(() => {
    const byCurrency = filterMovimientosByCurrency(movimientos, currency);
    const mm = byCurrency
      .filter((m) => isSameMonth(m.fecha))
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    // Mes anterior, para las variaciones del resumen
    const ahora = new Date();
    const prev = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    const pm = byCurrency.filter((m) => String(m.fecha || "").slice(0, 7) === prevKey);
    return {
      historical: summarizeByType(byCurrency),
      monthSummary: summarizeByType(mm),
      monthCount: mm.length,
      monthMovs: mm,
      prevSummary: summarizeByType(pm),
    };
  }, [movimientos, currency]);

  // Nombres de mes para el encabezado y los deltas del resumen
  const mesNombre = useMemo(
    () => new Date().toLocaleDateString("es-AR", { month: "long" }),
    []
  );
  const mesPrevNombre = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 1, 1).toLocaleDateString("es-AR", {
      month: "long",
    });
  }, []);
  const deltaPct = (cur, prevV) =>
    prevV > 0 ? Math.round(((cur - prevV) / prevV) * 100) : null;

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

  // Filas finas del resumen (debajo de la comparativa ingresos/egresos)
  const resRows = [
    { label: "Ahorro del mes", icon: "wallet-outline", color: "#2bb888", value: money(monthSummary.ahorro), onPress: () => goToFilter("ahorro") },
    { label: "Deuda pendiente", icon: "card-outline", color: ACCENTS.deuda, value: money(historical.deudaPendiente), onPress: () => goToFilter("deuda") },
  ];

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: pal.bg }} />;

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
                        <MaterialCommunityIcons name="history" size={25 * u} color="#0d1f28" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.bcIconBtn}
                        onPress={() => setVisible((v) => !v)}
                        hitSlop={6}
                      >
                        <Ionicons
                          name={visible ? "eye-outline" : "eye-off-outline"}
                          size={25 * u}
                          color="#0d1f28"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.bcIconBtn} onPress={flipCard} hitSlop={6}>
                        <Ionicons name="color-palette-outline" size={25 * u} color="#0d1f28" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Acciones dentro de la card, con el mismo relieve que los iconos de arriba */}
                  <View style={styles.bcQuickRow}>
                    {quickActions.map((a) => (
                      <TouchableOpacity
                        key={a.key}
                        style={styles.bcQuickItem}
                        onPress={() => setModalMode(a.key)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.bcQuickBtn,
                            { backgroundColor: card.iconBg, borderColor: card.iconBorder },
                          ]}
                        >
                          <Ionicons name={a.icon} size={22} color={a.color} />
                          {a.extra ? (
                            <Ionicons name={a.extra} size={13} color={a.color} style={styles.quickExtra} />
                          ) : null}
                        </View>
                        <Text style={[styles.bcQuickLabel, { color: card.text }]} numberOfLines={1}>
                          {a.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
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
                        {cardStyleKey === k ? <Ionicons name="checkmark" size={18} color="#071821" /> : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.cardBackDone} onPress={flipCard}>
                    <Text style={styles.cardBackDoneText}>Listo</Text>
                  </TouchableOpacity>
                </Animated.View>
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                {/* ===== Ticket con borde verde: Resumen / Historial ===== */}
                <View style={styles.ticket}>
                  <View style={styles.ticketSwitchRow}>
                    {/* Ver todos a la izquierda, en la misma fila que el switch */}
                    {resumenTab === "historial" ? (
                      <TouchableOpacity onPress={() => setShowHistory(true)} hitSlop={8} style={styles.verTodosWrap}>
                        <Text style={styles.verTodos}>Ver todos</Text>
                        <Ionicons name="chevron-forward" size={14} color={pal.verdeTexto} />
                      </TouchableOpacity>
                    ) : (
                      <View />
                    )}
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

                  {resumenTab === "resumen" ? (
                    <View style={styles.ticketBody}>
                      {/* Panel estilo analytics: ingresos vs egresos del mes */}
                      <View style={styles.resPanel}>
                        <View style={styles.resPanelHead}>
                          <Text style={styles.resPanelTitle}>Resumen del mes</Text>
                          <Text style={styles.resPanelMes}>{mesNombre} · {currencyTag}</Text>
                        </View>

                        {/* Barra proporcional ingresos (verde) vs egresos (rojo) */}
                        {(() => {
                          const inM = monthSummary.ingreso;
                          const outM = monthSummary.egreso;
                          const total = inM + outM;
                          const fIn = total > 0 ? Math.max(inM / total, inM > 0 ? 0.05 : 0) : 0;
                          const fOut = total > 0 ? Math.max(outM / total, outM > 0 ? 0.05 : 0) : 0;
                          return (
                            <View style={styles.ratioBar}>
                              {total > 0 ? (
                                <>
                                  {fIn > 0 ? <View style={[styles.ratioSeg, { flex: fIn, backgroundColor: VERDE }]} /> : null}
                                  {fOut > 0 ? <View style={[styles.ratioSeg, { flex: fOut, backgroundColor: ROJO }]} /> : null}
                                </>
                              ) : (
                                <View style={[styles.ratioSeg, { flex: 1, backgroundColor: "rgba(255,255,255,0.12)" }]} />
                              )}
                            </View>
                          );
                        })()}

                        <View style={styles.ieRow}>
                          {[
                            { label: "Ingresos", icon: "arrow-down", color: VERDE, val: monthSummary.ingreso, prev: prevSummary.ingreso, buenoSiSube: true, tipo: "ingreso" },
                            { label: "Egresos", icon: "arrow-up", color: ROJO, val: monthSummary.egreso, prev: prevSummary.egreso, buenoSiSube: false, tipo: "egreso" },
                          ].map((c, i) => {
                            const d = deltaPct(c.val, c.prev);
                            const favorable = d != null && (c.buenoSiSube ? d >= 0 : d <= 0);
                            return (
                              <React.Fragment key={c.label}>
                                {i > 0 ? <View style={styles.ieSep} /> : null}
                                <TouchableOpacity style={styles.ieCol} activeOpacity={0.7} onPress={() => goToFilter(c.tipo)}>
                                  <View style={styles.ieHead}>
                                    <Ionicons name={c.icon} size={16} color={c.color} />
                                    <Text style={styles.ieLabel}>{c.label}</Text>
                                  </View>
                                  <Text
                                    style={[styles.ieVal, { color: c.color }]}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.6}
                                  >
                                    {money(c.val)}
                                  </Text>
                                  {d != null ? (
                                    <Text style={[styles.ieDelta, { color: favorable ? pal.verdeTexto : "#ff6b5e" }]}>
                                      {d > 0 ? "+" : ""}{d}% vs {mesPrevNombre}
                                    </Text>
                                  ) : (
                                    <Text style={styles.ieDeltaMuted}>sin datos de {mesPrevNombre}</Text>
                                  )}
                                </TouchableOpacity>
                              </React.Fragment>
                            );
                          })}
                        </View>

                        <View style={styles.resDivider} />

                        {/* Filas finas: ahorro, deuda y movimientos */}
                        {resRows.map((r) => (
                          <TouchableOpacity key={r.label} style={styles.resSlimRow} activeOpacity={0.6} onPress={r.onPress}>
                            <Ionicons name={r.icon} size={19} color={r.color} />
                            <Text style={styles.resSlimLabel}>{r.label}</Text>
                            <Text style={[styles.resSlimVal, { color: r.color }]}>{r.value}</Text>
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                          style={styles.resSlimRow}
                          activeOpacity={0.6}
                          onPress={() => setResumenTab("historial")}
                        >
                          <View style={styles.movCountDot} />
                          <Text style={styles.resSlimLabel}>Movimientos del mes</Text>
                          <Text style={styles.resSlimVal}>{visible ? monthCount : "••"}</Text>
                          <Ionicons name="chevron-forward" size={17} color={pal.muted} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.ticketBody, styles.resGroup, styles.resGroupPad]}>
                      {monthMovs.length === 0 ? (
                        <Text style={styles.movEmpty}>No hay movimientos este mes.</Text>
                      ) : (
                        (() => {
                          // Agrupado por día (más recientes primero) con el neto del día
                          const hoyKey = new Date().toISOString().slice(0, 10);
                          const ayerD = new Date();
                          ayerD.setDate(ayerD.getDate() - 1);
                          const ayerKey = ayerD.toISOString().slice(0, 10);
                          const grupos = [];
                          monthMovs.forEach((m) => {
                            const k = String(m.fecha || "").slice(0, 10);
                            let g = grupos[grupos.length - 1];
                            if (!g || g.k !== k) {
                              g = { k, items: [] };
                              grupos.push(g);
                            }
                            g.items.push(m);
                          });
                          const nombreDia = (k) =>
                            k === hoyKey
                              ? "Hoy"
                              : k === ayerKey
                                ? "Ayer"
                                : new Date(`${k}T12:00:00`).toLocaleDateString("es-AR", {
                                    day: "numeric",
                                    month: "long",
                                  });
                          return grupos.map((g) => (
                            <View key={g.k}>
                              <View style={styles.movDayHead}>
                                <Text style={styles.movDayLabel}>{nombreDia(g.k)}</Text>
                              </View>
                              {g.items.map((item, idx) => {
                                const meta = getMovementTypeMeta(item.tipo);
                                const abierto = expandedMovs.has(item._id);
                                const isDebt = item.tipo === "deuda";
                                const isPendingDebt = isDebt && item.deudaEstado !== "pagada";
                                const debtPaid = Number(item.deudaPagado) || 0;
                                const debtRemaining = (Number(item.monto) || 0) - debtPaid;
                                const isPartialDebt = isPendingDebt && debtPaid > 0;
                                return (
                                  <View key={item._id} style={idx > 0 ? styles.movTkDividerTop : null}>
                                    <TouchableOpacity
                                      style={styles.movTkTop}
                                      activeOpacity={0.7}
                                      onPress={() => toggleMovExpand(item._id)}
                                    >
                                      <View style={[styles.movRedIcon, { borderColor: meta.color + "55", backgroundColor: meta.color + "1f" }]}>
                                        <Ionicons name={movementIcon(item)} size={17} color={meta.color} />
                                      </View>
                                      <View style={styles.movTkInfo}>
                                        <Text style={styles.movRedTitle} numberOfLines={1}>
                                          {item.categoria || "Sin categoría"}
                                        </Text>
                                        <Text style={styles.movRedMeta} numberOfLines={1}>
                                          {meta.label}
                                          {item.medio ? ` · ${item.medio}` : ""}
                                          {item.desdeAhorro ? " · Uso de ahorro" : ""}
                                        </Text>
                                      </View>
                                      <View style={styles.movTkRight}>
                                        <Text style={[styles.movRedAmount, { color: meta.color }]}>
                                          {visible ? formatSignedMoney(item.monto, currency, item.tipo) : "••••"}
                                        </Text>
                                        {isPendingDebt ? (
                                          <Text style={styles.movPendTag}>{isPartialDebt ? "Parcial" : "Pendiente"}</Text>
                                        ) : null}
                                      </View>
                                      <Ionicons
                                        name={abierto ? "chevron-up" : "chevron-down"}
                                        size={17}
                                        color={pal.muted}
                                        style={{ marginLeft: 4 }}
                                      />
                                    </TouchableOpacity>

                                    {abierto ? (
                                      <View style={styles.movTkBody}>
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
                                              <Ionicons name="pencil" size={18} color={pal.muted} />
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
                              })}
                            </View>
                          ));
                        })()
                      )}
                    </View>
                  )}

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
                      <Ionicons name="information-circle-outline" size={19} color={pal.muted} />
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
                        color={pal.txt}
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
                  <ActivityIndicator color={pal.verdeTexto} style={{ alignSelf: "flex-start", marginTop: 6 }} />
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
                <Ionicons name="close" size={22} color={pal.verdeTexto} />
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
                <Ionicons name="close" size={22} color={pal.verdeTexto} />
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
                <Ionicons name="funnel-outline" size={16} color={pal.verdeTexto} />
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

const makeStyles = (u, p) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: p.bg },
  content: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 28 },

  // Contenedor redondeado de los tabs (borde gris, radio 34 del Figma).
  // Con moneda activa lleva un espaciador que después tapa la card (overlap).
  tabsShell: {
    borderWidth: 2,
    borderColor: p.tabBorder,
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
  segmentActive: { backgroundColor: p.pillBg },
  segmentText: { fontFamily: "Menda-Medium", fontSize: 25 * u, letterSpacing: -1 * u, color: p.txt },
  segmentTextActive: { fontFamily: "Menda-Bold", color: p.pillText },

  sectionLabel: {
    color: p.muted,
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
    borderColor: p.linea,
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
    color: p.txt,
    fontSize: 22 * u,
    letterSpacing: -1 * u,
  },
  infoBtn: { padding: 1 },
  curSwitch: {
    flexDirection: "row",
    backgroundColor: p.panelBg2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: p.linea,
    padding: 2,
  },
  curSwitchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  curSwitchBtnActive: { backgroundColor: VERDE },
  curSwitchText: { color: p.muted, fontWeight: "800", fontSize: 12 },
  curSwitchTextActive: { color: "#000000" },
  infoOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: 22,
  },
  infoCard: {
    backgroundColor: p.bg,
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
  infoTitle: { fontFamily: "Menda-Bold", color: p.txt, fontSize: 16, flex: 1 },
  infoBody: { gap: 10 },
  infoText: { color: "rgba(255,255,255,0.8)", fontSize: 14, lineHeight: 21 },
  infoStrong: { color: p.txt, fontWeight: "800" },
  infoTip: {
    color: p.txt,
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
  saldoTipText: { flex: 1, color: p.txt, fontSize: 13.5, lineHeight: 20 },
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
    backgroundColor: p.cardBackBg,
    borderWidth: 1,
    borderColor: p.linea,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingVertical: 26,
  },
  cardBackTitle: { fontFamily: "Menda-Bold", color: p.txt, fontSize: 13 },
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
  bcIcons: { flexDirection: "row", gap: 7 * u },
  // Con relieve para que se lean como botones apretables
  bcIconBtn: {
    width: 47 * u,
    height: 47 * u,
    borderRadius: 24 * u,
    backgroundColor: "#f4f4f4",
    borderWidth: 1.5,
    borderColor: "rgba(0,0,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2.5 },
    elevation: 5,
  },
  bcBalance: {
    fontFamily: "Menda-Bold",
    fontSize: 37 * u,
    letterSpacing: -1.5 * u,
    marginTop: 6 * u,
    fontVariant: ["tabular-nums"],
  },

  // Acciones dentro de la card: mismo relieve que los iconos de arriba
  bcQuickRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginTop: 22 * u,
  },
  bcQuickItem: { flex: 1, alignItems: "center", gap: 6 },
  // Cuadrado redondeado con el vidrio propio de cada estilo de tarjeta
  // (backgroundColor y borderColor se pasan inline desde card.iconBg/iconBorder)
  bcQuickBtn: {
    width: 50,
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  bcQuickLabel: { fontFamily: "Menda-Medium", fontSize: 12.5, letterSpacing: -0.3 },
  quickExtra: { marginLeft: -3, marginBottom: -9 },

  statGrid: { gap: 10 },

  // ---- Resumen/Historial en formato abierto (mockup): pastillas + lista sin marco ----
  ticket: {
    paddingHorizontal: 4 * u,
    paddingTop: 6 * u,
    paddingBottom: 10 * u,
    marginTop: 30 * u,
  },
  // Switch Resumen/Historial: contenedor cuadrado a la derecha (mockup 3)
  ticketSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ticketSwitch: {
    flexDirection: "row",
    backgroundColor: p.panelBg2,
    borderWidth: 1,
    borderColor: p.linea,
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
  ticketSegText: { fontFamily: "Menda-Medium", fontSize: 25 * u, letterSpacing: -1 * u, color: p.txt },
  ticketSegTextOn: { color: "#000000" },
  verTodosWrap: { flexDirection: "row", alignItems: "center", gap: 2, paddingLeft: 4 },
  verTodos: { fontFamily: "Menda-Medium", color: p.verdeTexto, fontSize: 14.5 },

  ticketBody: { marginTop: 18 * u, gap: 14 * u },
  // Caja con borde (la usa el historial reducido)
  resGroup: {
    borderWidth: 1,
    borderColor: p.linea,
    backgroundColor: p.panelBg,
    borderRadius: 18 * u,
    overflow: "hidden",
  },
  resGroupPad: { paddingHorizontal: 14 * u, paddingVertical: 4 * u },

  // ---- Panel estilo analytics del resumen ----
  resPanel: {
    borderWidth: 1,
    borderColor: p.linea,
    backgroundColor: p.panelBg,
    borderRadius: 20 * u,
    padding: 16 * u,
  },
  resPanelHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14 * u,
  },
  // Tipografía del panel en tamaños fijos (el factor u del Figma la dejaba ilegible)
  resPanelTitle: {
    fontFamily: "Menda-Bold",
    fontSize: 17,
    letterSpacing: -0.4,
    color: p.txt,
  },
  resPanelMes: {
    fontFamily: "Menda-Medium",
    fontSize: 13.5,
    color: p.muted,
    textTransform: "capitalize",
  },

  // Barra proporcional ingresos/egresos
  ratioBar: {
    flexDirection: "row",
    height: 10 * u,
    borderRadius: 6 * u,
    overflow: "hidden",
    gap: 2,
    marginBottom: 16 * u,
  },
  ratioSeg: { height: "100%", borderRadius: 6 * u },

  // Columnas Ingresos | Egresos
  ieRow: { flexDirection: "row", alignItems: "stretch" },
  ieCol: { flex: 1, gap: 4 * u },
  ieSep: { width: 1, backgroundColor: p.linea, marginHorizontal: 14 * u },
  ieHead: { flexDirection: "row", alignItems: "center", gap: 6 * u },
  ieLabel: {
    fontFamily: "Menda-Medium",
    fontSize: 14.5,
    letterSpacing: -0.3,
    color: p.muted,
  },
  ieVal: {
    fontFamily: "Menda-Bold",
    fontSize: 24,
    letterSpacing: -0.7,
    fontVariant: ["tabular-nums"],
  },
  ieDelta: { fontFamily: "Menda-Medium", fontSize: 12.5, letterSpacing: -0.2 },
  ieDeltaMuted: { fontFamily: "Menda-Medium", fontSize: 12.5, color: p.muted, letterSpacing: -0.2 },

  resDivider: { height: 1, backgroundColor: p.linea, marginVertical: 12 * u },

  // Filas finas (ahorro / deuda / movimientos)
  resSlimRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10 * u,
    paddingVertical: 10 * u,
  },
  resSlimLabel: {
    flex: 1,
    fontFamily: "Menda-Medium",
    fontSize: 15.5,
    letterSpacing: -0.3,
    color: p.txt,
  },
  resSlimVal: {
    fontFamily: "Menda-Bold",
    fontSize: 17,
    letterSpacing: -0.4,
    color: p.txt,
    fontVariant: ["tabular-nums"],
  },
  movCountDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: ACCENTS.movimientos,
    marginHorizontal: 5,
  },

  // ---- Historial reducido, agrupado por día ----
  movEmpty: { color: p.muted, fontSize: 13.5, textAlign: "center", paddingVertical: 22 },
  movDayHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 2,
  },
  movDayLabel: {
    color: p.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  movTkDividerTop: { borderTopWidth: 1, borderColor: p.linea },
  movTkTop: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12 },
  movTkInfo: { flex: 1, gap: 2 },
  movTkRight: { alignItems: "flex-end", gap: 2 },
  movTkBody: { paddingBottom: 12, paddingTop: 2, gap: 4 },
  movRedIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  movRedTitle: { color: p.txt, fontSize: 15.5, fontWeight: "700" },
  movRedMeta: { color: p.muted, fontSize: 12.5 },
  movRedAmount: { fontSize: 16, fontWeight: "800", fontVariant: ["tabular-nums"] },
  movPendTag: {
    color: "#f4c622",
    fontSize: 10.5,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  movRedDetail: { color: p.muted, fontSize: 13.5 },
  movRedDebt: { color: VERDE, fontSize: 13, fontWeight: "700" },
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

  balanceSub: { color: p.muted, fontSize: 13, marginTop: 6 },
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
  emptyText: { color: p.muted, fontSize: 14, marginTop: 4 },
  movRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: p.rowBg,
    borderWidth: 1,
    borderColor: p.linea,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  movTitle: { color: p.txt, fontSize: 14, fontWeight: "700" },
  movSub: { color: p.muted, fontSize: 12, marginTop: 2 },
  movMetaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  movDate: { color: p.muted, fontSize: 11 },
  movChip: { fontSize: 11, fontWeight: "800" },
  movAmount: { color: p.txt, fontSize: 15, fontWeight: "800" },
});
