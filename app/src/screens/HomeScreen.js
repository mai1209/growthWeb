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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from "react-native-svg";
import * as SecureStore from "expo-secure-store";
import { movimientoService } from "../api";
import { statAccents, useTheme } from "../theme";
import MovementFormModal from "../components/MovementFormModal";
import HistoryModal from "../components/HistoryModal";
import {
  filterMovimientosByCurrency,
  formatMoney,
  getCurrencyMeta,
  isSameMonth,
  summarizeByType,
} from "../utils/finance";

const HOME_TABS = [
  { key: "ARS", label: "ARS" },
  { key: "USD", label: "USD" },
  { key: "deuda", label: "Deudas" },
  { key: "ahorro", label: "Ahorros" },
];

const fmtDate = (value) => {
  const s = String(value || "").slice(0, 10);
  const [y, m, d] = s.split("-");
  return y && m && d ? `${d}/${m}/${y}` : s;
};

const CARD_STYLE_KEY = "gm_card_style";

// Estilos de la tarjeta de saldo (elegibles dando vuelta la tarjeta).
const CARD_STYLES = {
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
const CARD_ORDER = ["holo", "platino", "titanio", "chrome", "esmeralda", "champagne"];

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);

  // Pulso suave para los anillos de la tarjeta (respiran)
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const ringTranslateY = pulse.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] });

  // La tarjeta de saldo cambia con el tema: oscura en dark, mint clara en light
  const [cardStyleKey, setCardStyleKey] = useState("holo");
  const [flipped, setFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const card = CARD_STYLES[cardStyleKey] || CARD_STYLES.holo;

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
  const [infoOpen, setInfoOpen] = useState(false); // popup "cómo funciona"
  const [saldoInfoOpen, setSaldoInfoOpen] = useState(false); // popup info del saldo total
  const [typeCurrency, setTypeCurrency] = useState("ARS"); // ARS/USD dentro de Deuda/Ahorro

  const isCurrency = tab === "ARS" || tab === "USD";
  const currency = isCurrency ? tab : "ARS";

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

  const { historical, monthSummary, monthCount } = useMemo(() => {
    const byCurrency = filterMovimientosByCurrency(movimientos, currency);
    const monthMovs = byCurrency.filter((m) => isSameMonth(m.fecha));
    return {
      historical: summarizeByType(byCurrency),
      monthSummary: summarizeByType(monthMovs),
      monthCount: monthMovs.length,
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

  const currencyMeta = getCurrencyMeta(currency);
  const money = (amount) => (visible ? formatMoney(amount, currency) : "••••");
  const moneyOf = (amount, mon) => (visible ? formatMoney(amount, mon || "ARS") : "••••");

  const quickActions = [
    { key: "ingreso", label: "Ingreso", icon: "arrow-down-outline", color: "#2fa56f" },
    { key: "egreso", label: "Egreso", icon: "arrow-up-outline", color: "#e0654f" },
    { key: "ingreso-fijo", label: "Ing. fijo", icon: "repeat-outline", color: "#2f9e3a" },
    { key: "egreso-fijo", label: "Gasto fijo", icon: "sync-outline", color: "#d9774a" },
  ];

  const stats = [
    { label: "Movimientos del mes", value: visible ? String(monthCount) : "••", accent: statAccents.movimientos, tipo: null },
    { label: "Resultado mensual", value: money(monthSummary.total), accent: statAccents.resultado, tipo: null },
    { label: "Ingresos del mes", value: money(monthSummary.ingreso), accent: statAccents.ingreso, tipo: "ingreso" },
    { label: "Egresos del mes", value: money(monthSummary.egreso), accent: statAccents.egreso, tipo: "egreso" },
    { label: "Ahorro del mes", value: money(monthSummary.ahorro), accent: statAccents.ahorro, tipo: "ahorro" },
    { label: "Deuda pendiente", value: money(historical.deudaPendiente), accent: statAccents.deuda, tipo: "deuda" },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      {/* Selector segmentado FIJO — ARS · USD · Deudas · Ahorros */}
      <View style={styles.fixedHeader}>
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
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={fetchData} tintColor={colors.green} />
        }
      >
        <View style={styles.cardBody}>
            {isCurrency ? (
              <>
                {/* Tarjeta de saldo estilo credit card (se da vuelta para elegir color) */}
                <View style={styles.flipWrap}>
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
                        <Rect width={cardSize.w} height={cardSize.h} rx={24} fill="url(#cardGrad)" />
                        {/* Glow suave */}
                        <Circle cx={cardSize.w * 0.82} cy={cardSize.h * 0.2} r={74} fill={card.glow1} />
                        <Circle cx={cardSize.w * 0.12} cy={cardSize.h * 1.05} r={70} fill={card.glow3} />
                      </Svg>

                      {/* Anillos concéntricos que respiran (capa animada) */}
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          StyleSheet.absoluteFill,
                          { opacity: ringOpacity, transform: [{ translateY: ringTranslateY }] },
                        ]}
                      >
                        <Svg width={cardSize.w} height={cardSize.h}>
                          {[52, 108, 168, 232, 300].map((r, i) => (
                            <Circle
                              key={r}
                              cx={cardSize.w * 0.82}
                              cy={cardSize.h * 0.2}
                              r={r}
                              fill="none"
                              stroke={card.lineColor}
                              strokeWidth={1}
                              opacity={0.9 - i * 0.15}
                            />
                          ))}
                        </Svg>
                      </Animated.View>
                    </>
                  ) : null}

                  <View style={styles.bcTop}>
                    <View style={styles.bcKickerRow}>
                      <Text style={[styles.bcKicker, { color: card.muted }]}>Saldo total</Text>
                      <TouchableOpacity onPress={() => setSaldoInfoOpen(true)} hitSlop={8}>
                        <Ionicons name="information-circle-outline" size={17} color={card.muted} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.bcIcons}>
                      <TouchableOpacity
                        style={[styles.bcIconBtn, { borderColor: card.iconBorder, backgroundColor: card.iconBg }]}
                        onPress={() => goToFilter(null)}
                        hitSlop={6}
                      >
                        <Ionicons name="funnel-outline" size={16} color={card.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.bcIconBtn, { borderColor: card.iconBorder, backgroundColor: card.iconBg }]}
                        onPress={() => setShowHistory(true)}
                        hitSlop={6}
                      >
                        <Ionicons name="time-outline" size={17} color={card.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.bcIconBtn, { borderColor: card.iconBorder, backgroundColor: card.iconBg }]}
                        onPress={() => setVisible((v) => !v)}
                        hitSlop={6}
                      >
                        <Ionicons
                          name={visible ? "eye-outline" : "eye-off-outline"}
                          size={17}
                          color={card.text}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.bcIconBtn, { borderColor: card.iconBorder, backgroundColor: card.iconBg }]}
                        onPress={flipCard}
                        hitSlop={6}
                      >
                        <Ionicons name="color-palette-outline" size={17} color={card.text} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {loading ? (
                    <ActivityIndicator color="#14d95f" style={{ alignSelf: "flex-start", marginVertical: 14 }} />
                  ) : (
                    <Text style={[styles.bcBalance, { color: card.text }]}>{money(historical.total)}</Text>
                  )}

                  {/* Acciones dentro de la tarjeta (estilo referencia) */}
                  <View
                    style={[
                      styles.bcActions,
                      { backgroundColor: card.iconBg, borderColor: card.iconBorder },
                    ]}
                  >
                    {quickActions.map((a) => (
                      <TouchableOpacity
                        key={a.key}
                        style={styles.quickItem}
                        onPress={() => setModalMode(a.key)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={a.icon} size={25} color={a.color} />
                        <Text style={[styles.quickLabel, { color: card.text }]} numberOfLines={1}>
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
                        {cardStyleKey === k ? <Ionicons name="checkmark" size={18} color="#0e1a0e" /> : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.cardBackDone} onPress={flipCard}>
                    <Text style={styles.cardBackDoneText}>Listo</Text>
                  </TouchableOpacity>
                </Animated.View>
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                {/* Movimientos del mes (clickeables → Filtros filtrado) */}
                <Text style={styles.sectionLabel}>Resumen</Text>
                <View style={styles.statGrid}>
                  {stats.map((s) => (
                    <TouchableOpacity
                      key={s.label}
                      style={styles.statCard}
                      activeOpacity={0.7}
                      onPress={() => goToFilter(s.tipo)}
                    >
                      <View style={[styles.statBar, { backgroundColor: s.accent }]} />
                      <Text style={styles.statLabel}>{s.label}</Text>
                      <Text style={styles.statValue}>{s.value}</Text>
                    </TouchableOpacity>
                  ))}
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
                      <Ionicons name="information-circle-outline" size={19} color={colors.muted} />
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
                        color={colors.text}
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
                    style={[styles.addTypeBtn, { backgroundColor: tab === "deuda" ? "#d6a92e" : "#2bb888" }]}
                    onPress={() => setModalMode(tab)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name={tab === "deuda" ? "person-outline" : "wallet-outline"} size={18} color="#fff" />
                    <Text style={styles.quickLabel}>
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
                  <ActivityIndicator color={colors.green} style={{ alignSelf: "flex-start", marginTop: 6 }} />
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
                                    { color: isPaid ? colors.greenDark : isPartial ? colors.greenDark : "#d6a92e" },
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
                              { color: m.tipo === "deuda" ? "#e6bc3f" : "#35cfa4" },
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

      <HistoryModal
        visible={showHistory}
        movimientos={movimientos}
        currency={currency}
        onClose={() => setShowHistory(false)}
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
                <Ionicons name="close" size={22} color={colors.muted} />
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
                <Ionicons name="close" size={22} color={colors.muted} />
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
                <Ionicons name="funnel-outline" size={16} color={colors.greenDark} />
                <Text style={styles.saldoTipText}>
                  ¿Querés ver cuánto es en efectivo y cuánto en transferencia por separado?
                  Buscalo en Filtros, donde cada movimiento muestra su medio.
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

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 28 },

  fixedHeader: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 2, backgroundColor: colors.bg },
  cardStack: { position: "relative" },

  // Selector segmentado tipo píldora (mismo lenguaje que Filtros/Métricas)
  segmentRow: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 4,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
  },
  segmentActive: { backgroundColor: colors.segActive },
  segmentText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  segmentTextActive: { color: colors.segActiveText, fontWeight: "800" },

  sectionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 10,
  },

  // Contenido flotando, sin marco
  cardBody: { position: "relative", paddingTop: 2, paddingBottom: 8 },
  cardActions: {
    position: "absolute",
    top: 10,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 2,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    color: colors.green,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  balanceTitle: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 4 },
  typeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  typeHeaderRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  balanceLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  balanceLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  infoBtn: { padding: 1 },
  curSwitch: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 2,
  },
  curSwitchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  curSwitchBtnActive: { backgroundColor: colors.greenBright },
  curSwitchText: { color: colors.muted, fontWeight: "800", fontSize: 12 },
  curSwitchTextActive: { color: "#0e1a0e" },
  infoOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 22,
  },
  infoCard: {
    backgroundColor: colors.bg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
  },
  infoHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  infoTitle: { color: colors.text, fontSize: 17, fontWeight: "800", flex: 1 },
  infoBody: { gap: 10 },
  infoText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  infoStrong: { color: colors.text, fontWeight: "800" },
  infoTip: {
    color: colors.text,
    fontSize: 13.5,
    lineHeight: 20,
    backgroundColor: colors.greenSoft,
    borderRadius: 12,
    padding: 12,
    marginTop: 2,
    overflow: "hidden",
  },
  saldoTip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: colors.greenSoft,
    borderRadius: 12,
    padding: 12,
    marginTop: 2,
  },
  saldoTipText: { flex: 1, color: colors.text, fontSize: 13.5, lineHeight: 20 },
  infoOk: {
    marginTop: 18,
    alignSelf: "flex-end",
    backgroundColor: colors.greenBright,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  infoOkText: { color: "#0e1a0e", fontWeight: "800", fontSize: 14 },
  balanceValue: { color: colors.text, fontSize: 34, fontWeight: "900", marginTop: 4 },
  error: { color: colors.red, marginTop: 4 },

  // ===== Tarjeta de saldo (estilo credit card) =====
  flipWrap: { position: "relative" },
  balanceCard: {
    borderRadius: 24,
    padding: 18,
    minHeight: 172,
    justifyContent: "space-between",
    overflow: "hidden",
    backgroundColor: "#0c333c", // respaldo hasta que el SVG mida la tarjeta
  },
  cardBack: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  cardBackTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14 },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  swatchActive: { borderColor: colors.greenBright, borderWidth: 3 },
  cardBackDone: {
    backgroundColor: colors.greenBright,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 22,
  },
  cardBackDoneText: { color: "#0e1a0e", fontWeight: "800", fontSize: 14 },
  bcTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bcKickerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  bcKicker: {
    color: "rgba(236, 246, 243, 0.65)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  bcIcons: { flexDirection: "row", gap: 8 },
  bcIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(236, 246, 243, 0.22)",
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  bcBalance: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  bcFooter: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  bcCurrency: {
    color: "rgba(236, 246, 243, 0.85)",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  bcActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    gap: 4,
    marginTop: 16,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickItem: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 2 },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { color: colors.text, fontWeight: "700", fontSize: 12.5 },

  statGrid: { gap: 10 },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    paddingVertical: 14,
    paddingRight: 16,
    paddingLeft: 18,
    overflow: "hidden",
  },
  statBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  statLabel: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statValue: { color: colors.text, fontSize: 17, fontWeight: "800", textAlign: "right" },

  balanceSub: { color: colors.muted, fontSize: 13, marginTop: 4 },
  potText: { color: "#2bb888", fontSize: 14, fontWeight: "800", marginTop: 4 },
  typeBtnRow: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  addTypeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
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
  emptyText: { color: colors.muted, fontSize: 14, marginTop: 4 },
  movRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  movTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  movSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  movMetaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  movDate: { color: colors.muted, fontSize: 11 },
  movChip: { fontSize: 11, fontWeight: "800" },
  movAmount: { color: colors.text, fontSize: 15, fontWeight: "800" },
});
