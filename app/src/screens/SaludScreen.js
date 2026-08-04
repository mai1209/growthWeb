import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { Pedometer } from "expo-sensors";
import * as SecureStore from "expo-secure-store";
import { useTheme } from "../theme";
import { saludService } from "../api";
import CaminataModal from "../components/CaminataModal";
import RecorridosModal from "../components/RecorridosModal";
import TodosDatosModal from "../components/TodosDatosModal";
import GymPanel from "../components/GymPanel";
import NutricionModal from "../components/NutricionModal";
import AddComidaModal from "../components/AddComidaModal";
import { calcularPlan } from "../utils/nutricion";

const AGUA_KEY = "salud_agua_v1";
const CFG_KEY = "salud_config_v1";
const PASOS_HIST_KEY = "salud_pasos_hist_v1";
const PASOS_MANUAL_KEY = "salud_pasos_manual_v1";
const ANIMO_KEY = "salud_animo_v1";
const PESO_KEY = "salud_peso_v1";
const CAMINATAS_KEY = "salud_caminatas_v1";
const NUTRI_KEY = "salud_nutricion_v1";
const COMIDAS_KEY = "salud_comidas_v1";
const FRANJAS = [
  { key: "desayuno", label: "Desayuno", icon: "cafe-outline" },
  { key: "almuerzo", label: "Almuerzo", icon: "restaurant-outline" },
  { key: "merienda", label: "Merienda", icon: "ice-cream-outline" },
  { key: "cena", label: "Cena", icon: "moon-outline" },
  { key: "aperitivo", label: "Aperitivo", icon: "fast-food-outline" },
];
const MACRO_COLORS = { carb: "#d6a92e", prot: "#e0703f", fat: "#3aa0e0" };
const META_PASOS_DEF = 8000;
const META_AGUA_DEF = 2000; // ml
const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];
const MESES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const PERIODOS = [
  { key: "dia", label: "D" },
  { key: "semana", label: "S" },
  { key: "mes", label: "M" },
  { key: "anio", label: "A" },
];
const NOMBRE_PERIODO = { dia: "Día", semana: "Semana", mes: "Mes", anio: "Año" };
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
const addDays = (key, delta) => {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
};
const fechaLabel = (key, hoy) => {
  if (key === hoy) return "Hoy";
  if (key === addDays(hoy, -1)) return "Ayer";
  return new Date(`${key}T00:00:00`).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
};

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

// Path SVG suavizado (curvas) a partir de puntos [x,y].
function smoothPathApp(pts) {
  if (pts.length < 2) return pts.length ? `M ${pts[0][0]} ${pts[0][1]}` : "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

// Gráfico de línea suavizado (tendencia por período). Tocá un punto para ver el valor.
function LineaTendencia({ points, color, track, unidad }) {
  const [sel, setSel] = useState(null);
  const [ancho, setAncho] = useState(0);
  const W = 320;
  const H = 130;
  const padX = 8;
  const padTop = 14;
  const padBottom = 22;
  const n = points.length;
  const max = Math.max(...points.map((p) => p.value), 1);
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;
  const x = (i) => (n <= 1 ? W / 2 : padX + (i / (n - 1)) * innerW);
  const y = (v) => padTop + innerH - (v / max) * innerH;
  const xy = points.map((p, i) => [x(i), y(p.value)]);
  const linea = smoothPathApp(xy);
  const area = n >= 2 ? `${linea} L ${xy[n - 1][0]} ${padTop + innerH} L ${xy[0][0]} ${padTop + innerH} Z` : "";
  const step = n > 12 ? Math.ceil(n / 6) : 1;
  // Por defecto se muestra el último día; al tocar, ese día.
  const selEff = sel != null ? sel : n - 1;

  const tocar = (e) => {
    if (!ancho) return;
    const px = e.nativeEvent.locationX;
    const rel = Math.max(0, Math.min(1, px / ancho));
    setSel(n <= 1 ? 0 : Math.round(rel * (n - 1)));
  };

  return (
    <View
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={tocar}
      onResponderMove={tocar}
    >
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {area ? <Path d={area} fill={color} opacity={0.13} /> : null}
        <Path d={linea} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points[selEff] ? <Circle cx={xy[selEff][0]} cy={xy[selEff][1]} r={4.5} fill={color} /> : null}
        {points.map((p, i) =>
          i % step === 0 || i === n - 1 ? (
            <SvgText key={`t${i}`} x={x(i)} y={H - 5} fontSize={9} fontWeight="700" fill={track} textAnchor="middle">
              {p.label}
            </SvgText>
          ) : null
        )}
      </Svg>
      {points[selEff] ? (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" }}>
          <Text style={{ color, fontWeight: "800", fontSize: 12 }}>
            {points[selEff].value.toLocaleString("es-AR")} {unidad}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// Barra de progreso de un macro (consumido / meta).
function MacroBar({ label, val, meta, color, track, styles }) {
  const pct = meta > 0 ? Math.min(100, Math.round((val / meta) * 100)) : 0;
  return (
    <View>
      <View style={styles.macroBarTop}>
        <Text style={styles.macroBarLabel}>{label}</Text>
        <Text style={styles.macroBarVal}>
          {val} / {meta} g
        </Text>
      </View>
      <View style={[styles.macroBarTrack, { backgroundColor: track }]}>
        <View style={{ width: `${pct}%`, height: 6, borderRadius: 3, backgroundColor: color }} />
      </View>
    </View>
  );
}

// Sube secciones al backend en segundo plano (espejo en la web). Si falla, no
// molesta: lo local sigue siendo la fuente de verdad del teléfono.
const pushSalud = (partial) => {
  saludService.update(partial).catch(() => {});
};

export default function SaludScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const route = useRoute();

  // Vistas deep-linkeadas desde el menú: Movilidad, Calorías diarias y Gym.
  const [vista, setVista] = useState("movilidad");
  useEffect(() => {
    const v = route.params?.view;
    if (v === "movilidad" || v === "calorias" || v === "gym") setVista(v);
  }, [route.params?.view, route.params?._navTs]);
  const esCalorias = vista === "calorias";
  const esGym = vista === "gym";
  const [periodo, setPeriodo] = useState("semana"); // dia | semana | mes | anio

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
    if (cual === "manual") {
      const actual = Number(pasosManual[dayKey(new Date())]) || 0;
      setEditValor(actual ? String(actual) : "");
    } else {
      setEditValor(String(cual === "pasos" ? metaPasos : metaAgua));
    }
    setEditando(cual);
  };

  const guardarMeta = () => {
    if (editando === "manual") {
      const n = parseInt(editValor, 10) || 0;
      guardarPasosManual(dayKey(new Date()), n);
      setEditando(null);
      return;
    }
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
    pushSalud({ metas: { pasos: nextPasos, agua: nextAgua } });
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
    pushSalud({ pasos: nuevos }); // espejo en la web
  }, []);

  // Pasos cargados a mano (se SUMAN a los del sensor). Ej: caminaste sin el teléfono.
  const [pasosManual, setPasosManual] = useState({});
  useEffect(() => {
    SecureStore.getItemAsync(PASOS_MANUAL_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const m = JSON.parse(raw);
          if (m) {
            setPasosManual(m);
            pushSalud({ pasosManual: m });
          }
        } catch {}
      })
      .catch(() => {});
  }, []);

  const guardarPasosManual = useCallback((dia, valor) => {
    setPasosManual((prev) => {
      const next = { ...prev, [dia]: Math.max(0, Math.round(valor) || 0) };
      if (!next[dia]) delete next[dia];
      SecureStore.setItemAsync(PASOS_MANUAL_KEY, JSON.stringify(next)).catch(() => {});
      pushSalud({ pasosManual: next });
      return next;
    });
  }, []);

  useEffect(() => {
    let sub;
    let intervalo;
    let appSub;
    let vivo = true;

    // Solo el total de hoy (barato): se usa para el refresco automático.
    const refrescarHoy = async () => {
      try {
        const ahora = new Date();
        const hoy = await Pedometer.getStepCountAsync(startOfDay(ahora), ahora);
        if (vivo && hoy) setPasos(hoy.steps ?? 0);
      } catch {}
    };

    // Total de hoy + serie de los últimos 7 días + histórico.
    // OJO: el primer getStepCountAsync NO se atrapa acá a propósito: en Android
    // lanza (no soporta rango histórico) y así caemos al modo android, sin
    // sincronizar 0 al backend (que borraría los pasos reales).
    const cargarTodo = async () => {
      const ahora = new Date();
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
    };

    (async () => {
      const disponible = await Pedometer.isAvailableAsync().catch(() => false);
      if (!vivo) return;
      if (!disponible) {
        setModoPasos("no");
        return;
      }
      try {
        await cargarTodo();
        // Refresco automático mientras la pantalla está abierta (sin cerrar la app).
        intervalo = setInterval(refrescarHoy, 25000);
      } catch {
        // Android: sin histórico → contamos en vivo desde que se abre la app.
        if (!vivo) return;
        setModoPasos("android");
        setPasos(0);
        sub = Pedometer.watchStepCount((res) => setPasos(res?.steps ?? 0));
      }
    })();

    // Al volver a la app (foreground), recargamos todo al instante.
    appSub = AppState.addEventListener("change", (estado) => {
      if (estado === "active") cargarTodo().catch(() => {});
    });

    return () => {
      vivo = false;
      if (sub) sub.remove();
      if (intervalo) clearInterval(intervalo);
      if (appSub) appSub.remove();
    };
  }, []);

  // ---------------- Agua ----------------
  const hoy = dayKey(new Date());
  const [fechaCal, setFechaCal] = useState(dayKey(new Date())); // día que se ve en Comidas
  const [aguaDias, setAguaDias] = useState({});
  const agua = aguaDias[hoy] || 0;

  useEffect(() => {
    SecureStore.getItemAsync(AGUA_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const data = JSON.parse(raw);
          if (data?.dias) {
            setAguaDias((prev) => ({ ...data.dias, ...prev }));
            pushSalud({ agua: data.dias }); // sube el histórico local (espejo web)
          }
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
      pushSalud({ agua: { [hoy]: Math.max(0, nuevoHoy) } });
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
    pushSalud({ animo: { [hoy]: level } });
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
    pushSalud({ peso: { [hoy]: kg } });
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
          if (d?.dias) {
            setAnimoDias((prev) => ({ ...d.dias, ...prev }));
            pushSalud({ animo: d.dias });
          }
        } catch {}
      })
      .catch(() => {});
    SecureStore.getItemAsync(PESO_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const d = JSON.parse(raw);
          if (d?.dias) {
            setPesoDias((prev) => ({ ...d.dias, ...prev }));
            pushSalud({ peso: d.dias }); // el peso ya registrado también se refleja en la web
          }
        } catch {}
      })
      .catch(() => {});
  }, []);

  // ---------------- Caminatas (GPS) ----------------
  const [caminataOpen, setCaminataOpen] = useState(false);
  const [recorridosOpen, setRecorridosOpen] = useState(false);
  const [caminatas, setCaminatas] = useState([]);
  const [datosOpen, setDatosOpen] = useState(false); // "Todos los datos"

  useEffect(() => {
    SecureStore.getItemAsync(CAMINATAS_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const d = JSON.parse(raw);
          if (Array.isArray(d?.lista)) {
            setCaminatas((prev) => (prev.length ? prev : d.lista));
            pushSalud({ caminatas: d.lista });
          }
        } catch {}
      })
      .catch(() => {});
  }, []);

  const guardarCaminata = (walk) => {
    if (!walk || walk.metros <= 0) return;
    const ruta = Array.isArray(walk.ruta) ? walk.ruta.slice(0, 500) : [];
    const lista = [{ fecha: hoy, metros: walk.metros, secs: walk.secs, ruta }, ...caminatas].slice(0, 50);
    setCaminatas(lista);
    SecureStore.setItemAsync(CAMINATAS_KEY, JSON.stringify({ lista })).catch(() => {});
    pushSalud({ caminatas: lista });
  };

  const ultimaCaminata = caminatas[0];

  // ---------------- Nutrición (plan diario) ----------------
  const [nutriOpen, setNutriOpen] = useState(false);
  const [nutri, setNutri] = useState(null);

  useEffect(() => {
    SecureStore.getItemAsync(NUTRI_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const d = JSON.parse(raw);
          if (d) {
            setNutri(d);
            pushSalud({ nutri: d });
          }
        } catch {}
      })
      .catch(() => {});
  }, []);

  const guardarNutri = (cfg) => {
    setNutri(cfg);
    SecureStore.setItemAsync(NUTRI_KEY, JSON.stringify(cfg)).catch(() => {});
    pushSalud({ nutri: cfg });
  };

  const plan = calcularPlan(nutri);

  // ---------------- Comidas del día ----------------
  const [comidasDias, setComidasDias] = useState({});
  const [addComidaFranja, setAddComidaFranja] = useState(null); // objeto franja o null

  useEffect(() => {
    SecureStore.getItemAsync(COMIDAS_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const d = JSON.parse(raw);
          if (d?.dias) {
            setComidasDias((prev) => ({ ...d.dias, ...prev }));
            pushSalud({ comidas: d.dias });
          }
        } catch {}
      })
      .catch(() => {});
  }, []);

  const persistirComidas = (dias) => {
    const rec = {};
    Object.keys(dias)
      .sort()
      .slice(-30)
      .forEach((k) => {
        rec[k] = dias[k];
      });
    SecureStore.setItemAsync(COMIDAS_KEY, JSON.stringify({ dias: rec })).catch(() => {});
    return rec;
  };

  const agregarComida = (meal) => {
    const item = { id: `${Date.now()}${Math.floor(Math.random() * 1000)}`, ...meal };
    const arr = [...(comidasDias[fechaCal] || []), item];
    setComidasDias(persistirComidas({ ...comidasDias, [fechaCal]: arr }));
    pushSalud({ comidas: { [fechaCal]: arr } });
  };

  const borrarComida = (id) => {
    const arr = (comidasDias[fechaCal] || []).filter((c) => c.id !== id);
    setComidasDias(persistirComidas({ ...comidasDias, [fechaCal]: arr }));
    pushSalud({ comidas: { [fechaCal]: arr } });
  };

  // ---------------- Pull del backend (lo cargado desde la web) ----------------
  // Merge conservador: lo local gana; el servidor solo rellena lo que falta.
  // Excepciones de hoy: agua = máximo de ambos; comidas = unión por id.
  useEffect(() => {
    saludService
      .get()
      .then(({ data }) => {
        if (!data) return;
        setAguaDias((prev) => {
          const next = { ...(data.agua || {}), ...prev };
          if (data.agua?.[hoy] != null) next[hoy] = Math.max(prev[hoy] || 0, data.agua[hoy] || 0);
          SecureStore.setItemAsync(AGUA_KEY, JSON.stringify({ dias: next })).catch(() => {});
          return next;
        });
        setAnimoDias((prev) => {
          const next = { ...(data.animo || {}), ...prev };
          SecureStore.setItemAsync(ANIMO_KEY, JSON.stringify({ dias: next })).catch(() => {});
          return next;
        });
        setPesoDias((prev) => {
          const next = { ...(data.peso || {}), ...prev };
          SecureStore.setItemAsync(PESO_KEY, JSON.stringify({ dias: next })).catch(() => {});
          return next;
        });
        setPasosHist((prev) => {
          const next = { ...(data.pasos || {}), ...prev };
          SecureStore.setItemAsync(PASOS_HIST_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });
        setPasosManual((prev) => {
          const next = { ...(data.pasosManual || {}), ...prev };
          SecureStore.setItemAsync(PASOS_MANUAL_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        });
        setComidasDias((prev) => {
          const next = { ...(data.comidas || {}), ...prev };
          const serverHoy = data.comidas?.[hoy] || [];
          if (serverHoy.length) {
            const localHoy = prev[hoy] || [];
            const ids = new Set(localHoy.map((c) => c.id));
            next[hoy] = [...localHoy, ...serverHoy.filter((c) => !ids.has(c.id))];
          }
          SecureStore.setItemAsync(COMIDAS_KEY, JSON.stringify({ dias: next })).catch(() => {});
          return next;
        });
        setCaminatas((prev) => (prev.length ? prev : data.caminatas || []));
        if (data.nutri) setNutri((prev) => prev || data.nutri);
        if (data.metas?.pasos > 0) setMetaPasos((prev) => (prev === META_PASOS_DEF ? data.metas.pasos : prev));
        if (data.metas?.agua > 0) setMetaAgua((prev) => (prev === META_AGUA_DEF ? data.metas.agua : prev));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const comidasDelDia = comidasDias[fechaCal] || [];
  const consumido = comidasDelDia.reduce((a, c) => a + (c.kcal || 0), 0);
  const consCarb = comidasDelDia.reduce((a, c) => a + (c.carbG || 0), 0);
  const consProt = comidasDelDia.reduce((a, c) => a + (c.protG || 0), 0);
  const consFat = comidasDelDia.reduce((a, c) => a + (c.fatG || 0), 0);
  const restantes = plan ? plan.kcal - consumido : 0;
  const consumidoPct = plan && plan.kcal > 0 ? Math.min(100, (consumido / plan.kcal) * 100) : 0;

  // Pasos totales = sensor + carga manual. Se usa para el anillo, la tendencia y "Todos los datos".
  const pasosHoyTotal = (pasos || 0) + (Number(pasosManual[hoy]) || 0);
  const manualHoy = Number(pasosManual[hoy]) || 0;
  const pasosHistCombinado = useMemo(() => {
    const out = { ...pasosHist };
    Object.keys(pasosManual).forEach((k) => {
      out[k] = (Number(out[k]) || 0) + (Number(pasosManual[k]) || 0);
    });
    return out;
  }, [pasosHist, pasosManual]);

  const pctPasos = pasos != null ? Math.round((pasosHoyTotal / metaPasos) * 100) : 0;
  const pctAgua = Math.round((agua / metaAgua) * 100);

  // ----- Tendencia por período (D/S/M/A) -----
  const buckets = useMemo(() => {
    const ahora = new Date();
    if (periodo === "dia") return [{ label: "Hoy", dias: [dayKey(ahora)] }];
    if (periodo === "anio") {
      const arr = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const dim = new Date(y, m + 1, 0).getDate();
        const dias = [];
        for (let dd = 1; dd <= dim; dd++) dias.push(`${y}-${pad(m + 1)}-${pad(dd)}`);
        arr.push({ label: MESES[m], dias });
      }
      return arr;
    }
    const n = periodo === "mes" ? 30 : 7;
    const arr = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(ahora);
      d.setDate(d.getDate() - i);
      arr.push({
        label: periodo === "semana" ? DIAS_SEMANA[d.getDay()] : String(d.getDate()),
        dias: [dayKey(d)],
      });
    }
    return arr;
  }, [periodo]);

  // soloConDatos=true (mediciones como el peso): omite días sin registro en vez de mostrar 0.
  const construirTendencia = (getVal, soloConDatos = false) => {
    let points = buckets.map((b) => {
      const vals = b.dias.map(getVal).filter((v) => v > 0);
      const value = vals.length ? Math.round(vals.reduce((a, c) => a + c, 0) / vals.length) : 0;
      return { label: b.label, value };
    });
    if (soloConDatos) points = points.filter((p) => p.value > 0);
    const activos = points.filter((p) => p.value > 0);
    const promedio = activos.length
      ? Math.round(activos.reduce((a, c) => a + c.value, 0) / activos.length)
      : 0;
    return { points, promedio };
  };

  const [metricaMov, setMetricaMov] = useState("pasos");
  const [metricaCal, setMetricaCal] = useState("kcal");
  const METRICAS_MOV = [
    { key: "pasos", label: "Pasos", color: colors.greenBright, unidad: "pasos", getVal: (k) => Number(pasosHistCombinado[k]) || 0 },
    { key: "peso", label: "Peso", color: colors.greenBright, unidad: "kg", medicion: true, getVal: (k) => Number(pesoDias[k]) || 0 },
    {
      key: "dist",
      label: "Distancia",
      color: colors.greenBright,
      unidad: "km",
      getVal: (k) => caminatas.filter((c) => c.fecha === k).reduce((a, c) => a + (Number(c.metros) || 0), 0) / 1000,
    },
  ];
  const METRICAS_CAL = [
    { key: "kcal", label: "Calorías", color: "#e0703f", unidad: "kcal", getVal: (k) => (comidasDias[k] || []).reduce((a, c) => a + (Number(c.kcal) || 0), 0) },
    { key: "agua", label: "Hidratación", color: "#3aa0e0", unidad: "ml", getVal: (k) => Number(aguaDias[k]) || 0 },
  ];

  const renderTendencia = (metrics, sel, setSel) => {
    const m = metrics.find((x) => x.key === sel) || metrics[0];
    const tend = construirTendencia(m.getVal, m.medicion);
    return (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.cardHeadLeft}>
            <Ionicons name="trending-up-outline" size={18} color={m.color} />
            <Text style={styles.cardTitle}>Tendencia</Text>
          </View>
          <View style={styles.periodoSel}>
            {PERIODOS.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[styles.periodoBtn, periodo === p.key && styles.periodoBtnOn]}
                onPress={() => setPeriodo(p.key)}
              >
                <Text style={[styles.periodoText, periodo === p.key && styles.periodoTextOn]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {metrics.length > 1 ? (
          <View style={styles.metricaSel}>
            {metrics.map((x) => (
              <TouchableOpacity
                key={x.key}
                style={[styles.metricaChip, sel === x.key && styles.metricaChipOn]}
                onPress={() => setSel(x.key)}
              >
                <Text style={[styles.metricaText, sel === x.key && styles.metricaTextOn]}>{x.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        <View style={styles.tendResumen}>
          <Text style={[styles.tendNum, { color: m.color }]}>{tend.promedio.toLocaleString("es-AR")}</Text>
          <Text style={styles.tendUnidad}>{periodo === "dia" ? m.unidad : `${m.unidad} · promedio`}</Text>
        </View>
        {periodo === "dia" ? (
          <Text style={styles.ringSub}>Elegí Semana, Mes o Año para ver la tendencia.</Text>
        ) : (
          <LineaTendencia points={tend.points} color={m.color} track={colors.muted} unidad={m.unidad} />
        )}
      </View>
    );
  };

  if (esGym) return <GymPanel />;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitle}>
            <Ionicons
              name={esCalorias ? "flash-outline" : "pulse-outline"}
              size={22}
              color={colors.greenBright}
            />
            <Text style={styles.title}>{esCalorias ? "Calorías diarias" : "Movilidad"}</Text>
          </View>
          {!esCalorias ? (
            <View style={styles.animoTop}>
              {ANIMOS.map((a) => (
                <TouchableOpacity
                  key={a.level}
                  style={[styles.animoTopBtn, animoHoy === a.level && styles.animoTopBtnOn]}
                  onPress={() => setAnimo(a.level)}
                >
                  <Text style={styles.animoTopEmoji}>{a.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        {esCalorias ? (
        <>
        {renderTendencia(METRICAS_CAL, metricaCal, setMetricaCal)}
        {/* ---- Nutrición (plan) ---- */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadLeft}>
              <Ionicons name="flame-outline" size={18} color={colors.red} />
              <Text style={styles.cardTitle}>Nutrición</Text>
            </View>
            <TouchableOpacity style={styles.metaBtn} onPress={() => setNutriOpen(true)}>
              <Ionicons name="create-outline" size={14} color={colors.muted} />
              <Text style={styles.metaBtnText}>{plan ? "Editar" : "Configurar"}</Text>
            </TouchableOpacity>
          </View>
          {plan ? (
            <View>
              <Text style={styles.nutriKcal}>
                {plan.kcal.toLocaleString("es-AR")} <Text style={styles.nutriKcalU}>kcal / día</Text>
              </Text>
              <View style={styles.nutriMacros}>
                <View style={styles.nutriMacro}>
                  <Text style={styles.nutriMacroN}>{plan.carbG}g</Text>
                  <Text style={styles.nutriMacroL}>Carbos</Text>
                </View>
                <View style={styles.nutriMacro}>
                  <Text style={styles.nutriMacroN}>{plan.protG}g</Text>
                  <Text style={styles.nutriMacroL}>Proteína</Text>
                </View>
                <View style={styles.nutriMacro}>
                  <Text style={styles.nutriMacroN}>{plan.fatG}g</Text>
                  <Text style={styles.nutriMacroL}>Grasa</Text>
                </View>
              </View>
            </View>
          ) : (
            <Text style={styles.ringSub}>
              Configurá tu peso, altura y objetivo para ver tu norma diaria de calorías.
            </Text>
          )}
        </View>

        {/* ---- Comidas (con historial por fecha) ---- */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadLeft}>
              <Ionicons name="restaurant-outline" size={18} color={colors.greenDark} />
              <Text style={styles.cardTitle}>Comidas</Text>
            </View>
            <View style={styles.dateNav}>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setFechaCal(addDays(fechaCal, -1))}>
                <Ionicons name="chevron-back" size={16} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.dateText}>{fechaLabel(fechaCal, hoy)}</Text>
              <TouchableOpacity
                style={styles.dateBtn}
                disabled={fechaCal >= hoy}
                onPress={() => fechaCal < hoy && setFechaCal(addDays(fechaCal, 1))}
              >
                <Ionicons name="chevron-forward" size={16} color={fechaCal >= hoy ? colors.cardBorder : colors.text} />
              </TouchableOpacity>
            </View>
          </View>
          {plan ? (
            <>
              <View style={styles.comidasTop}>
                <Ring percent={consumidoPct} size={116} stroke={12} color={colors.red} track={colors.cardBorder}>
                  <View style={styles.ringCenter}>
                    <Text style={styles.ringBig}>{restantes.toLocaleString("es-AR")}</Text>
                    <Text style={styles.ringSub}>kcal restantes</Text>
                  </View>
                </Ring>
                <View style={{ flex: 1, gap: 10 }}>
                  <MacroBar label="Carbos" val={consCarb} meta={plan.carbG} color={MACRO_COLORS.carb} track={colors.cardBorder} styles={styles} />
                  <MacroBar label="Proteína" val={consProt} meta={plan.protG} color={MACRO_COLORS.prot} track={colors.cardBorder} styles={styles} />
                  <MacroBar label="Grasa" val={consFat} meta={plan.fatG} color={MACRO_COLORS.fat} track={colors.cardBorder} styles={styles} />
                </View>
              </View>

              {FRANJAS.map((f) => {
                const items = comidasDelDia.filter((c) => c.franja === f.key);
                const tot = items.reduce((a, c) => a + (c.kcal || 0), 0);
                return (
                  <View key={f.key} style={styles.franja}>
                    <View style={styles.franjaHead}>
                      <Ionicons name={f.icon} size={16} color={colors.greenDark} />
                      <Text style={styles.franjaLabel}>{f.label}</Text>
                      <Text style={styles.franjaKcal}>{tot} kcal</Text>
                      <TouchableOpacity style={styles.franjaAdd} onPress={() => setAddComidaFranja(f)}>
                        <Ionicons name="add" size={18} color="#06210a" />
                      </TouchableOpacity>
                    </View>
                    {items.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        style={styles.comidaRow}
                        onPress={() => borrarComida(c.id)}
                      >
                        <Text style={styles.comidaNombre} numberOfLines={1}>
                          {c.nombre}
                        </Text>
                        <Text style={styles.comidaKcal}>{c.kcal} kcal</Text>
                        <Ionicons name="close" size={14} color={colors.muted} />
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
            </>
          ) : (
            <Text style={styles.ringSub}>
              Configurá tu plan de Nutrición para registrar tus comidas.
            </Text>
          )}
        </View>

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
        </>
        ) : (
        <>
        {/* Todos los datos (estilo Salud de iPhone) */}
        <TouchableOpacity style={styles.verTodosTop} onPress={() => setDatosOpen(true)}>
          <Text style={styles.verTodosText}>Ver todos los resultados</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.greenDark} />
        </TouchableOpacity>

        {renderTendencia(METRICAS_MOV, metricaMov, setMetricaMov)}

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

        {/* ---- Pasos de hoy (debajo de la caminata GPS) ---- */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadLeft}>
              <Ionicons name="walk-outline" size={18} color={colors.greenDark} />
              <Text style={styles.cardTitle}>Pasos</Text>
            </View>
            <View style={styles.pasosBtns}>
              <TouchableOpacity style={styles.metaBtnIcon} onPress={() => setRecorridosOpen(true)} accessibilityLabel="Ver recorridos en el mapa">
                <Ionicons name="map-outline" size={16} color={colors.muted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.metaBtn} onPress={() => abrirEdicion("manual")}>
                <Ionicons name="add-circle-outline" size={14} color={colors.muted} />
                <Text style={styles.metaBtnText}>Manual</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.metaBtn} onPress={() => abrirEdicion("pasos")}>
                <Ionicons name="create-outline" size={14} color={colors.muted} />
                <Text style={styles.metaBtnText}>Meta</Text>
              </TouchableOpacity>
            </View>
          </View>

          {modoPasos === "no" ? (
            <Text style={styles.aviso}>Tu teléfono no tiene sensor de pasos disponible.</Text>
          ) : (
            <View style={styles.pasosBody}>
              <Ring percent={pctPasos} color={colors.greenBright} track={colors.cardBorder}>
                <View style={styles.ringCenter}>
                  <Text style={styles.ringBig}>
                    {pasos != null ? pasosHoyTotal.toLocaleString("es-AR") : "—"}
                  </Text>
                  <Text style={styles.ringSub}>de {metaPasos.toLocaleString("es-AR")}</Text>
                  {manualHoy > 0 ? (
                    <Text style={styles.manualHint}>+{manualHoy.toLocaleString("es-AR")} manual</Text>
                  ) : null}
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
                <Text style={styles.ringSub}>Cargalo cuando quieras</Text>
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

        </>
        )}
      </ScrollView>

      {/* Editar meta */}
      <Modal visible={editando != null} transparent animationType="fade" onRequestClose={() => setEditando(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditando(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editando === "manual"
                ? "Pasos cargados a mano (hoy)"
                : editando === "pasos"
                ? "Meta de pasos por día"
                : "Meta de agua por día (ml)"}
            </Text>
            {editando === "manual" ? (
              <Text style={styles.modalSub}>
                Se suman a los que cuenta el teléfono. Útil si caminaste sin el celular. Poné 0 para
                sacarlos.
              </Text>
            ) : null}
            <TextInput
              style={styles.modalInput}
              value={editValor}
              onChangeText={(v) => setEditValor(v.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              placeholder={editando === "pasos" ? "8000" : editando === "manual" ? "0" : "2000"}
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

      <RecorridosModal
        visible={recorridosOpen}
        onClose={() => setRecorridosOpen(false)}
        caminatas={caminatas}
      />

      <TodosDatosModal
        visible={datosOpen}
        onClose={() => setDatosOpen(false)}
        pasosHist={pasosHistCombinado}
        aguaDias={aguaDias}
        animoDias={animoDias}
        pesoDias={pesoDias}
        comidasDias={comidasDias}
        caminatas={caminatas}
      />

      <NutricionModal
        visible={nutriOpen}
        onClose={() => setNutriOpen(false)}
        onGuardar={guardarNutri}
        initial={nutri}
        pesoSugerido={pesoActual}
      />

      <AddComidaModal
        visible={addComidaFranja != null}
        franja={addComidaFranja}
        onClose={() => setAddComidaFranja(null)}
        onGuardar={agregarComida}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: 16, paddingTop: 2, paddingBottom: 100, gap: 12 },
    kicker: { color: colors.greenDark, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
    title: { color: colors.text, fontSize: 22, fontWeight: "800" },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 6,
      flexWrap: "wrap",
    },
    headerTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
    animoTop: { flexDirection: "row", gap: 4 },
    animoTopBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    animoTopBtnOn: { borderColor: "#d6a92e", backgroundColor: "rgba(214,169,46,0.16)" },
    animoTopEmoji: { fontSize: 18 },

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
    periodoSel: {
      flexDirection: "row",
      gap: 2,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 999,
      padding: 2,
    },
    periodoBtn: { width: 30, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center" },
    periodoBtnOn: { backgroundColor: colors.greenBright },
    periodoText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
    periodoTextOn: { color: "#06210a" },
    dateNav: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 999,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    dateBtn: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    dateText: {
      minWidth: 78,
      textAlign: "center",
      color: colors.text,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "capitalize",
    },
    metricaSel: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
    metricaChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    metricaChipOn: { borderColor: colors.greenBright, backgroundColor: "rgba(93,199,45,0.14)" },
    metricaText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    metricaTextOn: { color: colors.greenBright },
    tendResumen: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 4 },
    tendNum: { fontSize: 30, fontWeight: "900" },
    tendUnidad: { color: colors.muted, fontSize: 13, fontWeight: "700", marginBottom: 4 },
    metaBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    metaBtnText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
    metaBtnIcon: {
      width: 32,
      height: 30,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },

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
    modalSub: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 6 },
    pasosBtns: { flexDirection: "row", gap: 5 },
    manualHint: { color: colors.greenBright, fontSize: 11, fontWeight: "800", marginTop: 2 },
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

    verTodosTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 2,
      marginBottom: 2,
    },
    verTodosText: { color: colors.greenDark, fontSize: 14, fontWeight: "800" },

    nutriKcal: { color: colors.text, fontSize: 30, fontWeight: "900" },
    nutriKcalU: { color: colors.muted, fontSize: 15, fontWeight: "700" },
    nutriMacros: { flexDirection: "row", gap: 12, marginTop: 10 },
    nutriMacro: {
      flex: 1,
      alignItems: "center",
      gap: 2,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.cardSoft,
    },
    nutriMacroN: { color: colors.text, fontSize: 16, fontWeight: "800" },
    nutriMacroL: { color: colors.muted, fontSize: 11, fontWeight: "700" },

    comidasTop: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 4 },
    macroBarTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
    macroBarLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
    macroBarVal: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    macroBarTrack: { height: 6, borderRadius: 3, overflow: "hidden" },

    franja: { borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 10, gap: 6 },
    franjaHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    franjaLabel: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "800" },
    franjaKcal: { color: colors.muted, fontSize: 13, fontWeight: "700" },
    franjaAdd: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.greenBright,
      alignItems: "center",
      justifyContent: "center",
    },
    comidaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: colors.cardSoft,
    },
    comidaNombre: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "600" },
    comidaKcal: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  });
