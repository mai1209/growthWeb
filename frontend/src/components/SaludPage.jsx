import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiActivity,
  FiDroplet,
  FiHeart,
  FiInfo,
  FiNavigation,
  FiPlus,
  FiRefreshCw,
  FiSmile,
  FiTrendingUp,
  FiX,
} from "react-icons/fi";
import { saludService } from "../api";
import { calcularPlan } from "../utils/nutricion";
import { BASE_COMIDAS } from "../utils/comidasBase";
import { buscarComidasOFF } from "../utils/openFoodFacts";
import GymView from "./GymView";
import style from "../style/Salud.module.css";

// Normaliza para comparar sin acentos ni mayúsculas.
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];
const MESES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const PERIODOS = [
  { key: "dia", label: "D" },
  { key: "semana", label: "S" },
  { key: "mes", label: "M" },
  { key: "anio", label: "A" },
];
const FRANJAS = [
  { key: "desayuno", label: "Desayuno" },
  { key: "almuerzo", label: "Almuerzo" },
  { key: "merienda", label: "Merienda" },
  { key: "cena", label: "Cena" },
  { key: "aperitivo", label: "Aperitivo" },
];

// Formatea la cantidad: 0.5 -> "0,5", 2 -> "2", 1.5 -> "1,5".
const fmtCant = (n) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ","));
const ANIMOS = [
  { level: 1, emoji: "😔", label: "Mal" },
  { level: 2, emoji: "😕", label: "Bajón" },
  { level: 3, emoji: "😐", label: "Normal" },
  { level: 4, emoji: "🙂", label: "Bien" },
  { level: 5, emoji: "😄", label: "Genial" },
];

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (key, delta) => {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
};
const fechaLabel = (key, hoy) => {
  if (key === hoy) return "Hoy";
  if (key === addDays(hoy, -1)) return "Ayer";
  return new Date(`${key}T00:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" });
};

// Navegador de día (‹ Ayer ›) para ver el historial. No deja pasar del día de hoy.
function DateNav({ fecha, setFecha, hoy }) {
  return (
    <div className={style.dateNav}>
      <button type="button" onClick={() => setFecha(addDays(fecha, -1))} aria-label="Día anterior">
        ‹
      </button>
      <span>{fechaLabel(fecha, hoy)}</span>
      <button
        type="button"
        onClick={() => fecha < hoy && setFecha(addDays(fecha, 1))}
        disabled={fecha >= hoy}
        aria-label="Día siguiente"
      >
        ›
      </button>
    </div>
  );
}

function Ring({ percent, size = 130, stroke = 12, color, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent || 0));
  return (
    <div className={style.ring} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--border-color)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className={style.ringCenter}>{children}</div>
    </div>
  );
}

function Semana({ dias, valores, meta, color }) {
  const max = Math.max(meta, ...valores, 1);
  return (
    <div className={style.semana}>
      {valores.map((v, i) => (
        <div key={i} className={style.semanaCol}>
          <div className={style.semanaBarWrap}>
            <div
              className={style.semanaBar}
              style={{
                height: `${Math.max(4, Math.round((v / max) * 100))}%`,
                background: v >= meta ? color : "var(--border-color)",
              }}
            />
          </div>
          <span className={style.semanaLbl}>{dias[i]}</span>
        </div>
      ))}
    </div>
  );
}

// Devuelve un path SVG suavizado (curvas) a partir de puntos [x,y].
function smoothPath(pts) {
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

// Gráfico de línea suavizado en SVG. Las etiquetas van como HTML (nítidas y chicas).
// Al pasar el mouse/tocar muestra el valor del día (tooltip).
function LineChart({ points, color, unidad }) {
  const [hover, setHover] = useState(null);
  const [pinned, setPinned] = useState(null); // día fijado con click/toque
  const W = 100;
  const H = 120;
  const padTop = 10;
  const padBottom = 8;
  const n = points.length;
  const max = Math.max(...points.map((p) => p.value), 1);
  const innerH = H - padTop - padBottom;
  const xy = points.map((p, i) => [
    n <= 1 ? W / 2 : (i / (n - 1)) * W,
    padTop + innerH - (p.value / max) * innerH,
  ]);
  const line = smoothPath(xy);
  const area = n >= 2 ? `${line} L ${xy[n - 1][0]} ${H} L ${xy[0][0]} ${H} Z` : "";
  const step = n > 12 ? Math.ceil(n / 6) : 1;

  const idxFrom = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const rel = Math.max(0, Math.min(1, cx / rect.width));
    return n <= 1 ? 0 : Math.round(rel * (n - 1));
  };

  // Selección efectiva: hover del mouse → día fijado con click → por defecto el último día.
  const sel = hover != null ? hover : pinned != null ? pinned : n - 1;
  const h = sel != null && points[sel] ? { p: points[sel], x: xy[sel][0], y: xy[sel][1] } : null;

  return (
    <div
      className={style.chartWrap}
      style={{ cursor: "pointer" }}
      onMouseMove={(e) => setHover(idxFrom(e))}
      onMouseLeave={() => setHover(null)}
      onClick={(e) => {
        const i = idxFrom(e);
        setPinned((prev) => (prev === i ? null : i));
      }}
    >
      <svg className={style.lineSvg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
        {area ? <path d={area} fill={color} opacity="0.13" /> : null}
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      {h ? (
        <>
          <div className={style.chartGuide} style={{ left: `${h.x}%` }} />
          <div className={style.chartDot} style={{ left: `${h.x}%`, top: `${h.y}px`, background: color }} />
          <div className={style.chartTip} style={{ left: `${h.x}%`, borderColor: color }}>
            <strong>{h.p.value.toLocaleString("es-AR")}</strong> {unidad}
          </div>
        </>
      ) : null}
      <div className={style.lineLabels}>
        {points.map((p, i) => (
          <span key={i} className={sel === i ? style.lineLblOn : undefined}>
            {i % step === 0 || i === n - 1 ? p.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

// Historial completo de una métrica: gráfico de toda la serie + lista de cada
// registro (más nuevo primero). Se abre desde "Todos los resultados".
function HistorialModal({ metric, hoy, onClose }) {
  if (!metric) return null;
  const { titulo, color, unidad, getVal, keys, fmt, emoji } = metric;
  const fechas = [...new Set(keys())]
    .filter(Boolean)
    .filter((k) => getVal(k) > 0)
    .sort();
  const serie = fechas.map((k) => ({
    label: new Date(`${k}T00:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" }),
    value: getVal(k),
  }));
  const lista = [...fechas].reverse();
  const fmtValor = (v) => (emoji ? emoji[Math.round(v)] || "—" : fmt(v));

  return (
    <div className={style.histOverlay} onClick={onClose}>
      <div className={style.histModal} onClick={(e) => e.stopPropagation()}>
        <div className={style.histHead}>
          <h3 style={{ color }}>{titulo}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {serie.length >= 2 ? (
          <LineChart points={serie.slice(-30)} color={color} unidad={unidad} />
        ) : (
          <p className={style.hint}>Necesitás al menos 2 registros para ver el gráfico.</p>
        )}
        <div className={style.histLista}>
          {lista.length ? (
            lista.map((k) => (
              <div key={k} className={style.histFila}>
                <span className={style.histFecha}>{fechaLabel(k, hoy)}</span>
                <strong className={style.histValor} style={{ color }}>
                  {fmtValor(getVal(k))} {!emoji ? <small>{unidad}</small> : null}
                </strong>
              </div>
            ))
          ) : (
            <p className={style.hint}>Todavía no hay registros de {titulo.toLowerCase()}.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SaludPage() {
  // El nav deep-linkea las dos vistas: /salud (Movilidad) y /salud?view=calorias.
  const [searchParams] = useSearchParams();
  const esCalorias = searchParams.get("view") === "calorias";
  const esGym = searchParams.get("view") === "gym";
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [periodo, setPeriodo] = useState("semana"); // dia | semana | mes | anio
  const [pesoInput, setPesoInput] = useState("");
  const [formFranja, setFormFranja] = useState(null); // franja abierta para agregar
  const [fNombre, setFNombre] = useState("");
  const [fKcal, setFKcal] = useState("");
  const [fCarb, setFCarb] = useState("");
  const [fProt, setFProt] = useState("");
  const [fFat, setFFat] = useState("");
  const [fCant, setFCant] = useState("1"); // cantidad (porciones o gramos según fModo; admite decimales)
  const [fUnidad, setFUnidad] = useState(""); // unidad de la porción (pote, puñado, cucharada…)
  const [fGramos, setFGramos] = useState(0); // gramos que pesa 1 porción (0 = desconocido)
  const [fModo, setFModo] = useState("porcion"); // "porcion" | "g"
  const [elegida, setElegida] = useState(false); // ya eligió sugerencia → ocultar lista
  const [onlineComidas, setOnlineComidas] = useState([]); // resultados de Open Food Facts

  const hoy = dayKey(new Date());
  const [fechaCal, setFechaCal] = useState(hoy); // día que se ve en Comidas
  const [fechaMov, setFechaMov] = useState(hoy); // día que se ve en Todos los resultados
  const [histTitulo, setHistTitulo] = useState(null); // métrica abierta en el historial completo

  useEffect(() => {
    saludService
      .get()
      .then(({ data: d }) => setData(d))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  const mutate = async (partial) => {
    try {
      const { data: d } = await saludService.update(partial);
      setData(d);
    } catch {}
  };

  const metaPasos = data?.metas?.pasos > 0 ? data.metas.pasos : 8000;
  const metaAgua = data?.metas?.agua > 0 ? data.metas.agua : 2000;
  // Pasos totales del día = sensor (del teléfono) + carga manual.
  const pasosDe = (k) => (Number(data?.pasos?.[k]) || 0) + (Number(data?.pasosManual?.[k]) || 0);
  const pasosHoy = pasosDe(hoy);
  const agua = Number(data?.agua?.[hoy]) || 0;
  const animoHoy = data?.animo?.[hoy];
  const plan = useMemo(() => calcularPlan(data?.nutri), [data]);

  const ultimos7 = useMemo(() => {
    const dias = [];
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dias.push(dayKey(d));
      labels.push(DIAS_SEMANA[d.getDay()]);
    }
    return { dias, labels };
  }, []);

  const pesoEntries = useMemo(() => {
    const keys = Object.keys(data?.peso || {}).sort();
    return keys.map((k) => Number(data.peso[k]));
  }, [data]);
  const pesoActual = pesoEntries.length ? pesoEntries[pesoEntries.length - 1] : null;
  const pesoDelta = pesoEntries.length >= 2 ? pesoActual - pesoEntries[pesoEntries.length - 2] : null;

  // "Todos los resultados" para un día de referencia (ventana de 7 días que termina ahí).
  const metricasDe = (refKey) => {
    if (!data) return [];
    const dias = [];
    const base = new Date(`${refKey}T00:00:00`);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      dias.push(dayKey(d));
    }
    const h = refKey;
    const kcalDia = (arr) => (arr || []).reduce((a, c) => a + (Number(c.kcal) || 0), 0);
    const camDia = (k) => (data.caminatas || []).filter((c) => c.fecha === k);
    const distDia = (k) => camDia(k).reduce((a, c) => a + (Number(c.metros) || 0), 0);
    const minDia = (k) => camDia(k).reduce((a, c) => a + (Number(c.secs) || 0), 0) / 60;
    const camRef = camDia(h)[0];
    const velocidad = camRef && camRef.secs > 0 ? (camRef.metros / 1000) / (camRef.secs / 3600) : null;
    const emojis = { 1: "😔", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };
    // Peso: última medición registrada hasta el día de referencia (se arrastra).
    const pesoHasta = Object.keys(data.peso || {}).filter((k) => k <= refKey).sort();
    const pesoRef = pesoHasta.length ? Number(data.peso[pesoHasta[pesoHasta.length - 1]]) : null;

    const keysCaminatas = () => (data.caminatas || []).map((c) => c.fecha);
    return [
      {
        titulo: "Pasos",
        color: "var(--color-verde, #5dc72d)",
        valor: pasosDe(h).toLocaleString("es-AR"),
        unidad: "pasos",
        barras: dias.map((k) => pasosDe(k)),
        getVal: (k) => pasosDe(k),
        keys: () => [...Object.keys(data.pasos || {}), ...Object.keys(data.pasosManual || {})],
        fmt: (v) => Math.round(v).toLocaleString("es-AR"),
      },
      {
        titulo: "Distancia de caminata",
        color: "var(--color-verde, #5dc72d)",
        valor: (distDia(h) / 1000).toFixed(1).replace(".", ","),
        unidad: "km",
        barras: dias.map(distDia),
        getVal: (k) => distDia(k) / 1000,
        keys: keysCaminatas,
        fmt: (v) => v.toFixed(2).replace(".", ","),
      },
      {
        titulo: "Tiempo de caminata",
        color: "var(--color-verde, #5dc72d)",
        valor: String(Math.round(minDia(h))),
        unidad: "min",
        barras: dias.map(minDia),
        getVal: (k) => minDia(k),
        keys: keysCaminatas,
        fmt: (v) => String(Math.round(v)),
      },
      {
        titulo: "Velocidad al caminar",
        color: "var(--color-verde, #5dc72d)",
        valor: velocidad != null ? velocidad.toFixed(1).replace(".", ",") : "—",
        unidad: "km/h",
        barras: dias.map((k) => {
          const c = camDia(k)[0];
          return c && c.secs > 0 ? (c.metros / 1000) / (c.secs / 3600) : 0;
        }),
        getVal: (k) => {
          const c = camDia(k)[0];
          return c && c.secs > 0 ? (c.metros / 1000) / (c.secs / 3600) : 0;
        },
        keys: keysCaminatas,
        fmt: (v) => v.toFixed(1).replace(".", ","),
      },
      {
        titulo: "Hidratación",
        color: "#3aa0e0",
        valor: String(Number(data.agua?.[h]) || 0),
        unidad: "ml",
        barras: dias.map((k) => Number(data.agua?.[k]) || 0),
        getVal: (k) => Number(data.agua?.[k]) || 0,
        keys: () => Object.keys(data.agua || {}),
        fmt: (v) => Math.round(v).toLocaleString("es-AR"),
      },
      {
        titulo: "Calorías consumidas",
        color: "#e0703f",
        valor: String(kcalDia(data.comidas?.[h])),
        unidad: "kcal",
        barras: dias.map((k) => kcalDia(data.comidas?.[k])),
        getVal: (k) => kcalDia(data.comidas?.[k]),
        keys: () => Object.keys(data.comidas || {}),
        fmt: (v) => Math.round(v).toLocaleString("es-AR"),
      },
      {
        titulo: "Ánimo",
        color: "#d6a92e",
        valor: data.animo?.[h] ? emojis[data.animo[h]] : "—",
        unidad: data.animo?.[h] ? "registrado" : "sin registrar",
        barras: dias.map((k) => Number(data.animo?.[k]) || 0),
        getVal: (k) => Number(data.animo?.[k]) || 0,
        keys: () => Object.keys(data.animo || {}),
        emoji: emojis,
      },
      {
        titulo: "Peso",
        color: "var(--color-verde, #5dc72d)",
        valor: pesoRef != null ? String(pesoRef).replace(".", ",") : "—",
        unidad: "kg",
        barras: pesoHasta.slice(-7).map((k) => Number(data.peso[k]) || 0),
        getVal: (k) => Number(data.peso?.[k]) || 0,
        keys: () => Object.keys(data.peso || {}),
        fmt: (v) => String(v).replace(".", ","),
      },
    ];
  };
  const metricas = metricasDe(fechaMov);

  // ----- Tendencia por período (D/S/M/A) -----
  // Buckets: día = hoy; semana = 7 días; mes = 30 días; año = 12 meses.
  const buckets = useMemo(() => {
    const now = new Date();
    if (periodo === "dia") return [{ label: "Hoy", dias: [dayKey(now)] }];
    if (periodo === "anio") {
      const arr = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
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
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      arr.push({
        label: periodo === "semana" ? DIAS_SEMANA[d.getDay()] : String(d.getDate()),
        dias: [dayKey(d)],
      });
    }
    return arr;
  }, [periodo]);

  // Construye {points, promedio} para una métrica diaria (getVal por clave de día).
  // soloConDatos=true (mediciones como el peso): omite días sin registro en vez de mostrar 0.
  const construirTendencia = (getVal, soloConDatos = false) => {
    let points = buckets.map((b) => {
      const vals = b.dias.map(getVal).filter((v) => v > 0);
      // día/semana/mes: 1 día por bucket. año: promedio por día activo del mes.
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

  const kcalDiaFn = (k) => (data?.comidas?.[k] || []).reduce((a, c) => a + (Number(c.kcal) || 0), 0);
  const distDiaFn = (k) =>
    (data?.caminatas || []).filter((c) => c.fecha === k).reduce((a, c) => a + (Number(c.metros) || 0), 0) / 1000;

  const [metricaMov, setMetricaMov] = useState("pasos");
  const [metricaCal, setMetricaCal] = useState("kcal");
  const METRICAS_MOV = [
    { key: "pasos", label: "Pasos", color: "var(--color-verde, #5dc72d)", unidad: "pasos", getVal: (k) => pasosDe(k) },
    { key: "peso", label: "Peso", color: "var(--color-verde, #5dc72d)", unidad: "kg", medicion: true, getVal: (k) => Number(data?.peso?.[k]) || 0 },
    { key: "dist", label: "Distancia", color: "var(--color-verde, #5dc72d)", unidad: "km", getVal: distDiaFn },
  ];
  const METRICAS_CAL = [
    { key: "kcal", label: "Calorías", color: "#e0703f", unidad: "kcal", getVal: kcalDiaFn },
    { key: "agua", label: "Hidratación", color: "#3aa0e0", unidad: "ml", getVal: (k) => Number(data?.agua?.[k]) || 0 },
  ];

  const NOMBRE_PERIODO = { dia: "Día", semana: "Semana", mes: "Mes", anio: "Año" };
  const renderTendencia = (metrics, sel, setSel) => {
    const m = metrics.find((x) => x.key === sel) || metrics[0];
    const tend = construirTendencia(m.getVal, m.medicion);
    return (
      <section className={`${style.card} ${style.cardAncha}`}>
        <div className={style.cardHead}>
          <h2>Tendencia</h2>
          <div className={style.periodoSel}>
            {PERIODOS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={periodo === p.key ? style.periodoOn : style.periodoOff}
                onClick={() => setPeriodo(p.key)}
                title={NOMBRE_PERIODO[p.key]}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {metrics.length > 1 ? (
          <div className={style.metricaSel}>
            {metrics.map((x) => (
              <button
                key={x.key}
                type="button"
                className={sel === x.key ? style.metricaOn : style.metricaOff}
                onClick={() => setSel(x.key)}
              >
                {x.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className={style.tendResumen}>
          <strong style={{ color: m.color }}>{tend.promedio.toLocaleString("es-AR")}</strong>
          <span>{periodo === "dia" ? m.unidad : `${m.unidad} · promedio`}</span>
        </div>
        {periodo === "dia" ? (
          <p className={style.hint}>Elegí Semana, Mes o Año para ver la tendencia.</p>
        ) : (
          <LineChart points={tend.points} color={m.color} unidad={m.unidad} />
        )}
      </section>
    );
  };

  // Autocompletado: tu historial (promedio de registros previos) + base local.
  const historial = useMemo(() => {
    const map = new Map();
    Object.values(data?.comidas || {}).forEach((arr) => {
      (arr || []).forEach((c) => {
        const key = norm(c.nombre);
        if (!key) return;
        const e = map.get(key) || { nombre: c.nombre, n: 0, kcal: 0, carbG: 0, protG: 0, fatG: 0 };
        e.nombre = c.nombre;
        e.n += 1;
        e.kcal += Number(c.kcal) || 0;
        e.carbG += Number(c.carbG) || 0;
        e.protG += Number(c.protG) || 0;
        e.fatG += Number(c.fatG) || 0;
        map.set(key, e);
      });
    });
    return [...map.values()].map((e) => ({
      nombre: e.nombre,
      kcal: Math.round(e.kcal / e.n),
      carbG: Math.round(e.carbG / e.n),
      protG: Math.round(e.protG / e.n),
      fatG: Math.round(e.fatG / e.n),
      propia: true,
    }));
  }, [data]);

  // Busca en Open Food Facts (con debounce) como respaldo del listado local.
  useEffect(() => {
    const q = fNombre.trim();
    if (elegida || q.length < 3) {
      setOnlineComidas([]);
      return undefined;
    }
    let cancel = false;
    const t = setTimeout(async () => {
      const r = await buscarComidasOFF(q);
      if (!cancel) setOnlineComidas(r);
    }, 500);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [fNombre, elegida]);

  const sugerencias = useMemo(() => {
    const q = norm(fNombre);
    if (elegida || q.length < 2) return [];
    const delHistorial = historial.filter((h) => norm(h.nombre).includes(q));
    const deLaBase = BASE_COMIDAS.filter(
      (b) =>
        (norm(b.nombre).includes(q) || (b.alias && norm(b.alias).includes(q))) &&
        !delHistorial.some((h) => norm(h.nombre) === norm(b.nombre))
    );
    const locales = [...delHistorial, ...deLaBase].slice(0, 6);
    const yaHay = new Set(locales.map((x) => norm(x.nombre)));
    const web = onlineComidas.filter((o) => !yaHay.has(norm(o.nombre))).slice(0, 6);
    return [...locales, ...web];
  }, [fNombre, historial, elegida, onlineComidas]);

  const usarSugerencia = (s) => {
    setFNombre(s.nombre);
    setFKcal(String(s.kcal || ""));
    setFCarb(String(s.carbG || ""));
    setFProt(String(s.protG || ""));
    setFFat(String(s.fatG || ""));
    setFUnidad(s.unidad || "");
    setFGramos(Number(s.gramos) || 0);
    setFModo("porcion");
    setFCant("1");
    setElegida(true);
  };

  // Cambia entre contar porciones (pote, puñado…) y gramos exactos.
  const cambiarModo = (modo) => {
    if (modo === fModo) return;
    setFModo(modo);
    setFCant(modo === "g" ? String(fGramos || 100) : "1");
  };

  // Cantidad como número (admite "0,5"). En modo gramos, factor = gramos / gramosPorPorción.
  const cantNum = parseFloat(String(fCant).replace(",", ".")) || 0;
  const factor = fModo === "g" && fGramos > 0 ? cantNum / fGramos : cantNum || 1;
  const kcalUnit = parseInt(fKcal, 10) || 0; // kcal por porción
  const previewTotal = {
    kcal: Math.round(kcalUnit * factor),
    carb: Math.round((parseInt(fCarb, 10) || 0) * factor),
    prot: Math.round((parseInt(fProt, 10) || 0) * factor),
    fat: Math.round((parseInt(fFat, 10) || 0) * factor),
  };
  const kcal100 = fGramos > 0 ? Math.round((kcalUnit / fGramos) * 100) : 0; // kcal por 100 g

  const comidasDia = data?.comidas?.[fechaCal] || [];
  const consumido = comidasDia.reduce((a, c) => a + (Number(c.kcal) || 0), 0);
  const consCarb = comidasDia.reduce((a, c) => a + (Number(c.carbG) || 0), 0);
  const consProt = comidasDia.reduce((a, c) => a + (Number(c.protG) || 0), 0);
  const consFat = comidasDia.reduce((a, c) => a + (Number(c.fatG) || 0), 0);

  const guardarPeso = () => {
    const kg = parseFloat(String(pesoInput).replace(",", "."));
    if (!kg || kg <= 0) return;
    mutate({ peso: { [hoy]: kg } });
    setPesoInput("");
  };

  const abrirForm = (key) => {
    setFormFranja(key);
    setFNombre("");
    setFKcal("");
    setFCarb("");
    setFProt("");
    setFFat("");
    setFCant("1");
    setFUnidad("");
    setFGramos(0);
    setFModo("porcion");
    setElegida(false);
  };

  const agregarComida = () => {
    if (!fNombre.trim() || kcalUnit <= 0 || cantNum <= 0) return;
    const base = fNombre.trim();
    let nombre = base;
    if (fModo === "g") nombre = `${base} · ${fmtCant(cantNum)} g`;
    else if (fUnidad) nombre = `${base} · ${fmtCant(cantNum)} ${fUnidad}`;
    else if (cantNum !== 1) nombre = `${base} ×${fmtCant(cantNum)}`;
    const item = {
      id: `${Date.now()}`,
      franja: formFranja,
      nombre,
      kcal: previewTotal.kcal,
      carbG: previewTotal.carb,
      protG: previewTotal.prot,
      fatG: previewTotal.fat,
    };
    mutate({ comidas: { [fechaCal]: [...comidasDia, item] } });
    setFormFranja(null);
  };

  const borrarComida = (id) => {
    mutate({ comidas: { [fechaCal]: comidasDia.filter((c) => c.id !== id) } });
  };

  if (esGym) return <GymView />;
  if (cargando) return <p className={style.cargando}>Cargando tu salud…</p>;

  return (
    <div className={style.wrap}>
      <header className={style.header}>
        <div>
          <h1>{esCalorias ? "Calorías diarias" : "Movilidad"}</h1>
          <p className={style.subtitulo}>
            {esCalorias
              ? "Anotá tus comidas y mirá cuánto te queda del día."
              : "Los pasos y caminatas se miden desde el teléfono; lo demás también lo podés cargar acá."}
          </p>
        </div>
        {!esCalorias ? (
          <div className={style.animoHeader}>
            <h2 className={style.animoTitulo}>
              <FiSmile /> ¿Cómo te sentís hoy?
            </h2>
            <div className={style.animoRow}>
              {ANIMOS.map((a) => (
                <button
                  key={a.level}
                  type="button"
                  className={`${style.animoBtn} ${animoHoy === a.level ? style.animoBtnOn : ""}`}
                  onClick={() => mutate({ animo: { [hoy]: a.level } })}
                >
                  <span className={style.animoEmoji}>{a.emoji}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <div className={style.grid}>
        {!esCalorias ? (
        <>
        {/* Tendencia (full width) */}
        {renderTendencia(METRICAS_MOV, metricaMov, setMetricaMov)}

        {/* Peso + Caminatas lado a lado; Pasos de hoy va debajo. */}
        <div className={style.trioRow}>
          <section className={style.card}>
            <div className={style.cardHead}>
              <h2>
                <FiHeart /> Peso
              </h2>
            </div>
            <div className={style.pesoFila}>
              <div>
                <strong className={style.pesoNum}>{pesoActual != null ? `${pesoActual} kg` : "—"}</strong>
                {pesoDelta != null ? (
                  <p className={style.pesoDelta} style={{ color: pesoDelta <= 0 ? "var(--color-verde, #5dc72d)" : "#e66565" }}>
                    {pesoDelta > 0 ? "▲" : "▼"} {Math.abs(pesoDelta).toFixed(1)} kg vs. anterior
                  </p>
                ) : (
                  <p className={style.hint}>Cargalo cuando quieras</p>
                )}
              </div>
              <div className={style.pesoForm}>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={pesoInput}
                  onChange={(e) => setPesoInput(e.target.value)}
                  placeholder="kg"
                />
                <button type="button" onClick={guardarPeso}>
                  Guardar
                </button>
              </div>
            </div>
          </section>

          <section className={style.card}>
            <div className={style.cardHead}>
              <h2>
                <FiNavigation /> Caminatas
              </h2>
              <span className={style.badgeTel}>desde el teléfono</span>
            </div>
            {data?.caminatas?.length ? (
              <ul className={style.caminatas}>
                {data.caminatas.slice(0, 5).map((c, i) => (
                  <li key={i}>
                    <span>{c.fecha}</span>
                    <strong>{(c.metros / 1000).toFixed(2)} km</strong>
                    <span>{Math.floor((c.secs || 0) / 60)} min</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={style.hint}>Todavía no registraste caminatas desde la app.</p>
            )}
          </section>
        </div>

        {/* Pasos de hoy — debajo de Caminatas (ambos vienen del teléfono). */}
        <div className={style.trioRow}>
          <section className={style.card}>
            <div className={style.cardHead}>
              <h2>
                <FiActivity /> Pasos de hoy
              </h2>
              <button
                type="button"
                className={style.pasosManualBtn}
                title="Cargar pasos a mano (se suman a los del teléfono)"
                onClick={() => {
                  const actual = Number(data?.pasosManual?.[hoy]) || 0;
                  const v = window.prompt(
                    "Pasos cargados a mano para hoy (se suman a los del teléfono). Poné 0 para sacarlos:",
                    actual ? String(actual) : ""
                  );
                  if (v == null) return;
                  const n = Math.max(0, parseInt(v, 10) || 0);
                  mutate({ pasosManual: { [hoy]: n } });
                }}
              >
                <FiPlus /> Manual
              </button>
            </div>
            <div className={style.fila}>
              <Ring percent={(pasosHoy / metaPasos) * 100} color="var(--color-verde, #5dc72d)">
                <strong>{pasosHoy.toLocaleString("es-AR")}</strong>
                <small>de {metaPasos.toLocaleString("es-AR")}</small>
                {Number(data?.pasosManual?.[hoy]) > 0 ? (
                  <small className={style.manualHint}>+{Number(data.pasosManual[hoy]).toLocaleString("es-AR")} manual</small>
                ) : null}
              </Ring>
              <Semana
                dias={ultimos7.labels}
                valores={ultimos7.dias.map((k) => pasosDe(k))}
                meta={metaPasos}
                color="var(--color-verde, #5dc72d)"
              />
            </div>
          </section>
        </div>

        {/* Todos los resultados (estilo Salud de iPhone) */}
        <section className={`${style.card} ${style.cardAncha}`}>
          <div className={style.cardHead}>
            <h2>Todos los resultados</h2>
            <DateNav fecha={fechaMov} setFecha={setFechaMov} hoy={hoy} />
          </div>
          <div className={style.datosGrid}>
            {metricas.map((m) => (
              <button
                key={m.titulo}
                type="button"
                className={style.dato}
                onClick={() => setHistTitulo(m.titulo)}
                title={`Ver historial de ${m.titulo.toLowerCase()}`}
              >
                <p className={style.datoTitulo} style={{ color: m.color }}>
                  {m.titulo}
                </p>
                <div className={style.datoBody}>
                  <p className={style.datoValor}>
                    {m.valor} <span>{m.unidad}</span>
                  </p>
                  <div className={style.datoBars}>
                    {(m.barras.length ? m.barras : [0]).map((v, i, arr) => {
                      const max = Math.max(...arr, 1);
                      return (
                        <div
                          key={i}
                          style={{
                            width: 6,
                            borderRadius: 3,
                            height: `${Math.max(8, Math.round((v / max) * 100))}%`,
                            background: i === arr.length - 1 && v > 0 ? m.color : "var(--border-color)",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
        </>
        ) : (
        <>
        {renderTendencia(METRICAS_CAL, metricaCal, setMetricaCal)}
        <div className={style.calWrap}>
        {/* Nutrición + comidas (editable) */}
        <section className={`${style.card} ${style.calMain}`}>
          <div className={style.cardHead}>
            <h2>
              <FiTrendingUp /> Comidas
              <span
                className={style.infoIcon}
                tabIndex={0}
                title="C = Carbohidratos · P = Proteína · G = Grasa (en gramos, por unidad)"
              >
                <FiInfo />
                <span className={style.infoTip}>
                  <strong>C</strong> = Carbohidratos · <strong>P</strong> = Proteína ·{" "}
                  <strong>G</strong> = Grasa (en gramos)
                </span>
              </span>
            </h2>
            <DateNav fecha={fechaCal} setFecha={setFechaCal} hoy={hoy} />
            {plan ? (
              <span className={style.planResumen}>
                Plan: {plan.kcal.toLocaleString("es-AR")} kcal · C {plan.carbG}g · P {plan.protG}g · G {plan.fatG}g
              </span>
            ) : (
              <span className={style.hint}>Configurá tu plan desde la app</span>
            )}
          </div>

          {plan ? (
            <div className={style.fila}>
              <Ring percent={(consumido / plan.kcal) * 100} color="#e66565">
                <strong>{(plan.kcal - consumido).toLocaleString("es-AR")}</strong>
                <small>kcal restantes</small>
              </Ring>
              <div className={style.macros}>
                {[
                  { label: "Carbos", val: consCarb, meta: plan.carbG, color: "#d6a92e" },
                  { label: "Proteína", val: consProt, meta: plan.protG, color: "#e0703f" },
                  { label: "Grasa", val: consFat, meta: plan.fatG, color: "#3aa0e0" },
                ].map((m) => (
                  <div key={m.label} className={style.macro}>
                    <div className={style.macroTop}>
                      <span>{m.label}</span>
                      <span>
                        {m.val} / {m.meta} g
                      </span>
                    </div>
                    <div className={style.macroTrack}>
                      <div
                        className={style.macroFill}
                        style={{ width: `${Math.min(100, (m.val / m.meta) * 100)}%`, background: m.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {FRANJAS.map((f) => {
            const items = comidasDia.filter((c) => c.franja === f.key);
            const tot = items.reduce((a, c) => a + (Number(c.kcal) || 0), 0);
            return (
              <div key={f.key} className={style.franja}>
                <div className={style.franjaHead}>
                  <strong>{f.label}</strong>
                  <span>{tot} kcal</span>
                  <button type="button" className={style.franjaAdd} onClick={() => abrirForm(f.key)}>
                    <FiPlus />
                  </button>
                </div>
                {items.map((c) => (
                  <div key={c.id} className={style.comidaRow}>
                    <span className={style.comidaNombre}>{c.nombre}</span>
                    <span className={style.comidaKcal}>{c.kcal} kcal</span>
                    <button type="button" onClick={() => borrarComida(c.id)} title="Borrar">
                      <FiX />
                    </button>
                  </div>
                ))}
                {formFranja === f.key ? (
                  <div className={style.comidaForm}>
                    <div className={style.nombreWrap}>
                      <input
                        value={fNombre}
                        onChange={(e) => {
                          setFNombre(e.target.value);
                          setElegida(false);
                          setFUnidad("");
                          setFGramos(0);
                          setFModo("porcion");
                        }}
                        placeholder="¿Qué comiste?"
                        autoFocus
                      />
                      {sugerencias.length > 0 ? (
                        <ul className={style.sugerencias}>
                          {sugerencias.map((s, i) => (
                            <li key={i}>
                              <button type="button" onClick={() => usarSugerencia(s)}>
                                <span className={style.sugIcono}>{s.online ? "🌐" : s.propia ? "⏱" : "🍽"}</span>
                                <span className={style.sugNombre}>
                                  {s.nombre}
                                  {s.unidad ? (
                                    <em className={style.sugUnidad}>
                                      {" "}· {s.unidad}
                                      {s.gramos ? ` ≈${s.gramos} g` : ""}
                                    </em>
                                  ) : null}
                                </span>
                                <span className={style.sugKcal}>{s.kcal} kcal</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className={style.cantWrap}>
                      {fGramos > 0 ? (
                        <span className={style.modoToggle}>
                          <button
                            type="button"
                            className={fModo === "porcion" ? style.modoOn : style.modoOff}
                            onClick={() => cambiarModo("porcion")}
                          >
                            {fUnidad || "porción"}
                          </button>
                          <button
                            type="button"
                            className={fModo === "g" ? style.modoOn : style.modoOff}
                            onClick={() => cambiarModo("g")}
                          >
                            gramos
                          </button>
                        </span>
                      ) : null}
                      <input
                        type="number"
                        min="0"
                        step={fModo === "g" ? "10" : "0.5"}
                        value={fCant}
                        onChange={(e) => setFCant(e.target.value)}
                        className={style.cantInput}
                        title="Cantidad"
                      />
                      <span className={style.cantUnidad}>
                        {fModo === "g" ? "g" : fUnidad || "u."}
                      </span>
                      <span className={style.cantChips}>
                        {(fModo === "g" ? ["50", "100", "150", "200"] : ["0.5", "1", "2"]).map((v) => (
                          <button
                            key={v}
                            type="button"
                            className={style.cantChip}
                            onClick={() => setFCant(v)}
                          >
                            {v === "0.5" ? "½" : v}
                          </button>
                        ))}
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={fKcal}
                      onChange={(e) => setFKcal(e.target.value)}
                      placeholder={fUnidad ? `kcal x ${fUnidad}` : "kcal c/u"}
                      title={
                        fGramos > 0
                          ? `${fKcal || 0} kcal por ${fUnidad} (≈${kcal100} kcal/100 g)`
                          : "kcal por porción"
                      }
                    />
                    <input type="number" min="0" value={fCarb} onChange={(e) => setFCarb(e.target.value)} placeholder="C g" title="Carbohidratos (g) por porción" />
                    <input type="number" min="0" value={fProt} onChange={(e) => setFProt(e.target.value)} placeholder="P g" title="Proteína (g) por porción" />
                    <input type="number" min="0" value={fFat} onChange={(e) => setFFat(e.target.value)} placeholder="G g" title="Grasa (g) por porción" />
                    {kcalUnit > 0 && cantNum > 0 ? (
                      <span className={style.comidaTotal}>
                        = {previewTotal.kcal} kcal · C {previewTotal.carb} · P {previewTotal.prot} · G{" "}
                        {previewTotal.fat} g
                        {fModo === "g"
                          ? ` · ${fmtCant(cantNum)} g${
                              fGramos > 0 ? ` (≈ ${fmtCant(Math.round((cantNum / fGramos) * 10) / 10)} ${fUnidad})` : ""
                            }`
                          : fUnidad
                          ? ` · ${fmtCant(cantNum)} ${fUnidad}`
                          : cantNum !== 1
                          ? ` · ×${fmtCant(cantNum)}`
                          : ""}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={style.comidaOk}
                      onClick={agregarComida}
                      disabled={!fNombre.trim() || kcalUnit <= 0 || cantNum <= 0}
                    >
                      Agregar
                    </button>
                    <button type="button" className={style.comidaCancel} onClick={() => setFormFranja(null)}>
                      Cancelar
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>

        {/* Hidratación (editable) — el agua es parte de lo que consumís */}
        <section className={`${style.card} ${style.calAside}`}>
          <div className={style.cardHead}>
            <h2>
              <FiDroplet /> Hidratación
            </h2>
          </div>
          <div className={style.fila}>
            <Ring percent={(agua / metaAgua) * 100} color="#3aa0e0">
              <strong>{agua}</strong>
              <small>de {metaAgua} ml</small>
            </Ring>
            <Semana
              dias={ultimos7.labels}
              valores={ultimos7.dias.map((k) => Number(data?.agua?.[k]) || 0)}
              meta={metaAgua}
              color="#3aa0e0"
            />
          </div>
          <div className={style.acciones}>
            <button type="button" className={style.aguaBtn} onClick={() => mutate({ agua: { [hoy]: agua + 250 } })}>
              <FiPlus /> Vaso · 250
            </button>
            <button type="button" className={style.aguaBtn} onClick={() => mutate({ agua: { [hoy]: agua + 500 } })}>
              <FiPlus /> Botella · 500
            </button>
            <button type="button" className={style.resetBtn} onClick={() => mutate({ agua: { [hoy]: 0 } })} title="Reiniciar">
              <FiRefreshCw />
            </button>
          </div>
        </section>
        </div>
        </>
        )}

        <HistorialModal
          metric={histTitulo ? metricas.find((m) => m.titulo === histTitulo) : null}
          hoy={hoy}
          onClose={() => setHistTitulo(null)}
        />
      </div>
    </div>
  );
}
