import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { Pedometer } from "expo-sensors";
import * as SecureStore from "expo-secure-store";
import { useTheme } from "../theme";
import CaminataModal from "../components/CaminataModal";

const AGUA_KEY = "salud_agua_v1";
const CFG_KEY = "salud_config_v1";
const PASOS_HIST_KEY = "salud_pasos_hist_v1";
const ANIMO_KEY = "salud_animo_v1";
const PESO_KEY = "salud_peso_v1";
const CAMINATAS_KEY = "salud_caminatas_v1";
const META_PASOS_DEF = 8000;
const META_AGUA_DEF = 2000; // ml
const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];
const ANIMOS = [
  { level: 1, emoji: "😔", label: "Mal" },
  { level: 2, emoji: "😕", label: "Bajón" },
  { level: 3, emoji: "😐", label: "Normal" },
  { level: 4, emoji: "🙂", label: "Bien" },
  { level: 5, emoji: "😄", label: "Genial" },
];

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

// Anillo reutilizable con contenido custom en el centro.
function Ring({ percent, size = 140, stroke = 13, color, track, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent));
  const offset = c * (1 - pct / 100);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

// Mini gráfico de barras semanal.
function BarrasSemana({ valores, meta, color, track, styles }) {
  const max = Math.max(meta, ...valores.map((v) => v.valor), 1);
  return (
    <View style={styles.semanaRow}>
      {valores.map((v, i) => {
        const h = Math.max(3, Math.round((v.valor / max) * 54));
        const cumplida = v.valor >= meta;
        return (
          <View key={i} style={styles.semanaCol}>
            <View style={styles.semanaBarWrap}>
              <View
                style={{ width: 10, height: h, borderRadius: 5, backgroundColor: cumplida ? color : track }}
              />
            </View>
            <Text style={styles.semanaLabel}>{v.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function SaludScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // ---------------- Metas configurables ----------------
  const [metaPasos, setMetaPasos] = useState(META_PASOS_DEF);
  const [metaAgua, setMetaAgua] = useState(META_AGUA_DEF);
  const [editando, setEditando] = useState(null); // "pasos" | "agua" | null
  const [editValor, setEditValor] = useState("");

  useEffect(() => {
    SecureStore.getItemAsync(CFG_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const cfg = JSON.parse(raw);
          if (cfg.metaPasos > 0) setMetaPasos(cfg.metaPasos);
          if (cfg.metaAgua > 0) setMetaAgua(cfg.metaAgua);
        } catch {}
      })
      .catch(() => {});
  }, []);

  const abrirEdicion = (cual) => {
    setEditValor(String(cual === "pasos" ? metaPasos : metaAgua));
    setEditando(cual);
  };

  const guardarMeta = () => {
    const n = parseInt(editValor, 10);
    if (!n || n <= 0) {
      setEditando(null);
      return;
    }
    const nextPasos = editando === "pasos" ? n : metaPasos;
    const nextAgua = editando === "agua" ? n : metaAgua;
    setMetaPasos(nextPasos);
    setMetaAgua(nextAgua);
    SecureStore.setItemAsync(
      CFG_KEY,
      JSON.stringify({ metaPasos: nextPasos, metaAgua: nextAgua })
    ).catch(() => {});
    setEditando(null);
  };

  // ---------------- Pasos ----------------
  const [pasos, setPasos] = useState(null); // null = cargando
  const [pasosSemana, setPasosSemana] = useState([]);
  const [modoPasos, setModoPasos] = useState("cargando"); // cargando | ios | android | no

  // Histórico diario acumulado (para la gráfica de tendencia larga).
  const [pasosHist, setPasosHist] = useState({});
  useEffect(() => {
    SecureStore.getItemAsync(PASOS_HIST_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const h = JSON.parse(raw);
          if (h) setPasosHist(h);
        } catch {}
      })
      .catch(() => {});
  }, []);

  const guardarHist = useCallback((nuevos) => {
    setPasosHist((prev) => {
      const merged = { ...prev, ...nuevos };
      const recortado = {};
      Object.keys(merged)
        .sort()
        .slice(-400) // ~13 meses
        .forEach((k) => {
          recortado[k] = merged[k];
        });
      SecureStore.setItemAsync(PASOS_HIST_KEY, JSON.stringify(recortado)).catch(() => {});
      return recortado;
    });
  }, []);

  useEffect(() => {
    let sub;
    let vivo = true;
    (async () => {
      const disponible = await Pedometer.isAvailableAsync().catch(() => false);
      if (!vivo) return;
      if (!disponible) {
        setModoPasos("no");
        return;
      }
      const ahora = new Date();
      try {
        const hoy = await Pedometer.getStepCountAsync(startOfDay(ahora), ahora);
        if (!vivo) return;
        setPasos(hoy?.steps ?? 0);
        const dias = [];
        const nuevos = {}; // { "YYYY-MM-DD": pasos } de los últimos 7 días
        for (let i = 6; i >= 0; i--) {
          const d = new Date(ahora);
          d.setDate(d.getDate() - i);
          const ini = startOfDay(d);
          const fin = i === 0 ? ahora : new Date(ini.getTime() + 86399999);
          let steps = 0;
          try {
            const r = await Pedometer.getStepCountAsync(ini, fin);
            steps = r?.steps ?? 0;
          } catch {}
          dias.push({ label: DIAS_SEMANA[d.getDay()], valor: steps });
          nuevos[dayKey(d)] = steps;
        }
        if (vivo) {
          setPasosSemana(dias);
          setModoPasos("ios");
          guardarHist(nuevos); // acumulamos para tendencias largas
        }
      } catch {
        // Android: sin histórico → contamos en vivo desde que se abre la app.
        if (!vivo) return;
        setModoPasos("android");
        setPasos(0);
        sub = Pedometer.watchStepCount((res) => setPasos(res?.steps ?? 0));
      }
    })();
    return () => {
      vivo = false;
      if (sub) sub.remove();
    };
  }, []);

  // ---------------- Agua ----------------
  const hoy = dayKey(new Date());
  const [aguaDias, setAguaDias] = useState({});
  const agua = aguaDias[hoy] || 0;

  useEffect(() => {
    SecureStore.getItemAsync(AGUA_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const data = JSON.parse(raw);
          if (data?.dias) setAguaDias(data.dias);
        } catch {}
      })
      .catch(() => {});
  }, []);

  const guardarAgua = useCallback(
    (nuevoHoy) => {
      setAguaDias((prev) => {
        const dias = { ...prev, [hoy]: Math.max(0, nuevoHoy) };
        // Nos quedamos con los últimos 14 días para no crecer indefinidamente.
        const recortado = {};
        Object.keys(dias)
          .sort()
          .slice(-14)
          .forEach((k) => {
            recortado[k] = dias[k];
          });
        SecureStore.setItemAsync(AGUA_KEY, JSON.stringify({ dias: recortado })).catch(() => {});
        return recortado;
      });
    },
    [hoy]
  );

  const aguaSemana = useMemo(() => {
    const ahora = new Date();
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(ahora);
      d.setDate(d.getDate() - i);
      arr.push({ label: DIAS_SEMANA[d.getDay()], valor: aguaDias[dayKey(d)] || 0 });
    }
    return arr;
  }, [aguaDias]);

  // ---------------- Ánimo ----------------
  const [animoDias, setAnimoDias] = useState({});
  const animoHoy = animoDias[hoy];

  const setAnimo = (level) => {
    setAnimoDias((prev) => {
      const next = { ...prev, [hoy]: level };
      const rec = {};
      Object.keys(next)
        .sort()
        .slice(-60)
        .forEach((k) => {
          rec[k] = next[k];
        });
      SecureStore.setItemAsync(ANIMO_KEY, JSON.stringify({ dias: rec })).catch(() => {});
      return rec;
    });
  };

  // ---------------- Peso ----------------
  const [pesoDias, setPesoDias] = useState({});
  const [pesoInput, setPesoInput] = useState("");

  const guardarPeso = () => {
    const kg = parseFloat(String(pesoInput).replace(",", "."));
    if (!kg || kg <= 0) return;
    setPesoDias((prev) => {
      const next = { ...prev, [hoy]: kg };
      const rec = {};
      Object.keys(next)
        .sort()
        .slice(-120)
        .forEach((k) => {
          rec[k] = next[k];
        });
      SecureStore.setItemAsync(PESO_KEY, JSON.stringify({ dias: rec })).catch(() => {});
      return rec;
    });
    setPesoInput("");
  };

  const pesoEntries = useMemo(
    () => Object.keys(pesoDias).sort().map((k) => pesoDias[k]),
    [pesoDias]
  );
  const pesoActual = pesoEntries.length ? pesoEntries[pesoEntries.length - 1] : null;
  const pesoDelta =
    pesoEntries.length >= 2 ? pesoActual - pesoEntries[pesoEntries.length - 2] : null;

  useEffect(() => {
    SecureStore.getItemAsync(ANIMO_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const d = JSON.parse(raw);
          if (d?.dias) setAnimoDias(d.dias);
        } catch {}
      })
      .catch(() => {});
    SecureStore.getItemAsync(PESO_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const d = JSON.parse(raw);
          if (d?.dias) setPesoDias(d.dias);
        } catch {}
      })
      .catch(() => {});
  }, []);

  // ---------------- Caminatas (GPS) ----------------
  const [caminataOpen, setCaminataOpen] = useState(false);
  const [caminatas, setCaminatas] = useState([]);

  useEffect(() => {
    SecureStore.getItemAsync(CAMINATAS_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const d = JSON.parse(raw);
          if (Array.isArray(d?.lista)) setCaminatas(d.lista);
        } catch {}
      })
      .catch(() => {});
  }, []);

  const guardarCaminata = (walk) => {
    if (!walk || walk.metros <= 0) return;
    setCaminatas((prev) => {
      const lista = [{ fecha: hoy, metros: walk.metros, secs: walk.secs }, ...prev].slice(0, 50);
      SecureStore.setItemAsync(CAMINATAS_KEY, JSON.stringify({ lista })).catch(() => {});
      return lista;
    });
  };

  const ultimaCaminata = caminatas[0];

  // ---------------- Tendencia de pasos (últimos 30 días) ----------------
  const tendencia = useMemo(() => {
    const ahora = new Date();
    const arr = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(ahora);
      d.setDate(d.getDate() - i);
      const k = dayKey(d);
      const tiene = Object.prototype.hasOwnProperty.call(pasosHist, k);
      arr.push({ key: k, valor: tiene ? pasosHist[k] : 0, tiene });
    }
    return arr;
  }, [pasosHist]);
  const tendConDatos = tendencia.filter((x) => x.tiene);
  const promedioPasos = tendConDatos.length
    ? Math.round(tendConDatos.reduce((a, x) => a + x.valor, 0) / tendConDatos.length)
    : 0;
  const tendMax = Math.max(metaPasos, ...tendencia.map((t) => t.valor), 1);

  const pctPasos = pasos != null ? Math.round((pasos / metaPasos) * 100) : 0;
  const pctAgua = Math.round((agua / metaAgua) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>SALUD</Text>
        <Text style={styles.title}>Tu día</Text>

        {/* ---- Pasos ---- */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadLeft}>
              <Ionicons name="walk-outline" size={18} color={colors.greenDark} />
              <Text style={styles.cardTitle}>Pasos de hoy</Text>
            </View>
            <TouchableOpacity style={styles.metaBtn} onPress={() => abrirEdicion("pasos")}>
              <Ionicons name="create-outline" size={14} color={colors.muted} />
              <Text style={styles.metaBtnText}>Meta</Text>
            </TouchableOpacity>
          </View>

          {modoPasos === "no" ? (
            <Text style={styles.aviso}>Tu teléfono no tiene sensor de pasos disponible.</Text>
          ) : (
            <View style={styles.pasosBody}>
              <Ring percent={pctPasos} color={colors.greenBright} track={colors.cardBorder}>
                <View style={styles.ringCenter}>
                  <Text style={styles.ringBig}>
                    {pasos != null ? pasos.toLocaleString("es-AR") : "—"}
                  </Text>
                  <Text style={styles.ringSub}>de {metaPasos.toLocaleString("es-AR")}</Text>
                </View>
              </Ring>
              {modoPasos === "ios" && pasosSemana.length > 0 ? (
                <View style={{ flex: 1 }}>
                  <BarrasSemana
                    valores={pasosSemana}
                    meta={metaPasos}
                    color={colors.greenBright}
                    track={colors.cardBorder}
                    styles={styles}
                  />
                </View>
              ) : null}
            </View>
          )}

          {modoPasos === "android" ? (
            <Text style={styles.aviso}>
              En Android por ahora contamos los pasos desde que abrís la app. Pronto: histórico
              completo.
            </Text>
          ) : null}
        </View>

        {/* ---- Tendencia de pasos ---- */}
        {tendConDatos.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardHeadLeft}>
                <Ionicons name="trending-up-outline" size={18} color={colors.greenDark} />
                <Text style={styles.cardTitle}>Tendencia de pasos</Text>
              </View>
              <Text style={styles.metaBtnText}>Últimos 30 días</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.tendRow}>
                {tendencia.map((x) => {
                  const h = x.tiene ? Math.max(3, Math.round((x.valor / tendMax) * 90)) : 3;
                  const cumplida = x.valor >= metaPasos;
                  return (
                    <View key={x.key} style={styles.tendCol}>
                      <View
                        style={{
                          width: 7,
                          height: h,
                          borderRadius: 4,
                          backgroundColor: x.tiene
                            ? cumplida
                              ? colors.greenBright
                              : colors.greenDark
                            : colors.cardBorder,
                        }}
                      />
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <Text style={styles.ringSub}>
              Promedio: {promedioPasos.toLocaleString("es-AR")} pasos/día
            </Text>
          </View>
        ) : null}

        {/* ---- Hidratación ---- */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadLeft}>
              <Ionicons name="water-outline" size={18} color="#3aa0e0" />
              <Text style={styles.cardTitle}>Hidratación</Text>
            </View>
            <TouchableOpacity style={styles.metaBtn} onPress={() => abrirEdicion("agua")}>
              <Ionicons name="create-outline" size={14} color={colors.muted} />
              <Text style={styles.metaBtnText}>Meta</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pasosBody}>
            <Ring percent={pctAgua} color="#3aa0e0" track={colors.cardBorder}>
              <View style={styles.ringCenter}>
                <Text style={styles.ringBig}>{agua}</Text>
                <Text style={styles.ringSub}>de {metaAgua} ml</Text>
              </View>
            </Ring>
            <View style={{ flex: 1 }}>
              <BarrasSemana
                valores={aguaSemana}
                meta={metaAgua}
                color="#3aa0e0"
                track={colors.cardBorder}
                styles={styles}
              />
            </View>
          </View>

          <View style={styles.aguaBtns}>
            <TouchableOpacity style={styles.aguaBtn} onPress={() => guardarAgua(agua + 250)}>
              <Ionicons name="add" size={16} color="#3aa0e0" />
              <Text style={styles.aguaBtnText}>Vaso · 250</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.aguaBtn} onPress={() => guardarAgua(agua + 500)}>
              <Ionicons name="add" size={16} color="#3aa0e0" />
              <Text style={styles.aguaBtnText}>Botella · 500</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.aguaReset} onPress={() => guardarAgua(0)}>
              <Ionicons name="refresh" size={15} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ---- Ánimo ---- */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadLeft}>
              <Ionicons name="happy-outline" size={18} color="#d6a92e" />
              <Text style={styles.cardTitle}>¿Cómo te sentís hoy?</Text>
            </View>
          </View>
          <View style={styles.animoRow}>
            {ANIMOS.map((a) => (
              <TouchableOpacity
                key={a.level}
                style={[styles.animoBtn, animoHoy === a.level && styles.animoBtnOn]}
                onPress={() => setAnimo(a.level)}
              >
                <Text style={styles.animoEmoji}>{a.emoji}</Text>
                <Text style={[styles.animoLabel, animoHoy === a.level && styles.animoLabelOn]}>
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ---- Peso ---- */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadLeft}>
              <Ionicons name="body-outline" size={18} color={colors.greenDark} />
              <Text style={styles.cardTitle}>Peso</Text>
            </View>
          </View>
          <View style={styles.pesoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.ringBig}>{pesoActual != null ? `${pesoActual} kg` : "—"}</Text>
              {pesoDelta != null ? (
                <Text style={[styles.pesoDelta, { color: pesoDelta <= 0 ? colors.green : colors.red }]}>
                  {pesoDelta > 0 ? "▲" : "▼"} {Math.abs(pesoDelta).toFixed(1)} kg vs. anterior
                </Text>
              ) : (
                <Text style={styles.ringSub}>Registrá tu peso de hoy</Text>
              )}
            </View>
            <View style={styles.pesoInputRow}>
              <TextInput
                style={styles.pesoInput}
                value={pesoInput}
                onChangeText={(v) => setPesoInput(v.replace(/[^0-9.,]/g, ""))}
                keyboardType="decimal-pad"
                placeholder="kg"
                placeholderTextColor={colors.muted}
              />
              <TouchableOpacity style={styles.pesoSave} onPress={guardarPeso}>
                <Text style={styles.pesoSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ---- Caminata (GPS) ---- */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadLeft}>
              <Ionicons name="navigate-outline" size={18} color={colors.greenDark} />
              <Text style={styles.cardTitle}>Caminata</Text>
            </View>
          </View>
          {ultimaCaminata ? (
            <Text style={styles.ringSub}>
              Última: {(ultimaCaminata.metros / 1000).toFixed(2)} km ·{" "}
              {Math.floor(ultimaCaminata.secs / 60)} min
            </Text>
          ) : (
            <Text style={styles.ringSub}>Registrá tu primera caminata con GPS.</Text>
          )}
          <TouchableOpacity style={styles.caminataBtn} onPress={() => setCaminataOpen(true)}>
            <Ionicons name="play" size={16} color="#06210a" />
            <Text style={styles.caminataBtnText}>Iniciar caminata</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Editar meta */}
      <Modal visible={editando != null} transparent animationType="fade" onRequestClose={() => setEditando(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditando(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editando === "pasos" ? "Meta de pasos por día" : "Meta de agua por día (ml)"}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={editValor}
              onChangeText={(v) => setEditValor(v.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder={editando === "pasos" ? "8000" : "2000"}
              placeholderTextColor={colors.muted}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setEditando(null)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={guardarMeta}>
                <Text style={styles.modalSaveText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <CaminataModal
        visible={caminataOpen}
        onClose={() => setCaminataOpen(false)}
        onGuardar={guardarCaminata}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: 16, paddingTop: 2, paddingBottom: 100, gap: 12 },
    kicker: { color: colors.greenDark, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
    title: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 4 },

    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 18,
      padding: 16,
      gap: 12,
    },
    cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cardHeadLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    cardTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
    metaBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    metaBtnText: { color: colors.muted, fontSize: 12, fontWeight: "700" },

    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    modalCard: {
      width: "100%",
      backgroundColor: colors.bg,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 18,
      gap: 12,
    },
    modalTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
    modalInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
    },
    modalBtns: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
    modalCancel: { paddingHorizontal: 16, paddingVertical: 10 },
    modalCancelText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
    modalSave: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.greenBright,
    },
    modalSaveText: { color: "#06210a", fontSize: 14, fontWeight: "800" },

    pasosBody: { flexDirection: "row", alignItems: "center", gap: 16 },
    ringCenter: { alignItems: "center" },
    ringBig: { color: colors.text, fontSize: 24, fontWeight: "900" },
    ringSub: { color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 2 },

    semanaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
    semanaCol: { alignItems: "center", gap: 5, flex: 1 },
    semanaBarWrap: { height: 54, justifyContent: "flex-end" },
    semanaLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },

    aviso: { color: colors.muted, fontSize: 13, lineHeight: 18 },

    tendRow: { flexDirection: "row", alignItems: "flex-end", height: 96, gap: 3 },
    tendCol: { justifyContent: "flex-end", height: 96 },

    aguaBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
    aguaBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flex: 1,
      justifyContent: "center",
      paddingVertical: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(58,160,224,0.4)",
      backgroundColor: "rgba(58,160,224,0.12)",
    },
    aguaBtnText: { color: "#3aa0e0", fontSize: 13, fontWeight: "800" },
    aguaReset: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },

    animoRow: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
    animoBtn: {
      flex: 1,
      alignItems: "center",
      gap: 4,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    animoBtnOn: { borderColor: "#d6a92e", backgroundColor: "rgba(214,169,46,0.14)" },
    animoEmoji: { fontSize: 22 },
    animoLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },
    animoLabelOn: { color: "#d6a92e" },

    pesoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    pesoDelta: { fontSize: 12, fontWeight: "800", marginTop: 2 },
    pesoInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    pesoInput: {
      width: 72,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
      textAlign: "center",
    },
    pesoSave: {
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: colors.greenBright,
    },
    pesoSaveText: { color: "#06210a", fontSize: 13, fontWeight: "800" },

    caminataBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: colors.greenBright,
    },
    caminataBtnText: { color: "#06210a", fontSize: 14, fontWeight: "800" },
  });
