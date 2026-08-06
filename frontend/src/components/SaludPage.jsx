import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
  FiActivity,
  FiCalendar,
  FiMap,
  FiDroplet,
  FiHeart,
  FiInfo,
  FiNavigation,
  FiPlay,
  FiPlus,
  FiRefreshCw,
  FiSmile,
  FiTrash2,
  FiTrendingUp,
  FiX,
} from "react-icons/fi";
import {
  MdDirectionsWalk,
  MdDirectionsRun,
  MdDirectionsBike,
  MdFreeBreakfast,
  MdRestaurant,
  MdIcecream,
  MdNightlight,
  MdFastfood,
} from "react-icons/md";
import { saludService } from "../api";
import { calcularPlan, ACTIVIDADES, OBJETIVOS } from "../utils/nutricion";
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
  { key: "desayuno", label: "Desayuno", Icon: MdFreeBreakfast },
  { key: "almuerzo", label: "Almuerzo", Icon: MdRestaurant },
  { key: "merienda", label: "Merienda", Icon: MdIcecream },
  { key: "cena", label: "Cena", Icon: MdNightlight },
  { key: "aperitivo", label: "Aperitivo", Icon: MdFastfood },
];

// Formatea la cantidad: 0.5 -> "0,5", 2 -> "2", 1.5 -> "1,5".
const fmtCant = (n) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ","));

// Estimación de calorías quemadas por los pasos, ajustada por peso.
// ~0,04 kcal/paso para 70 kg; escala lineal con el peso.
const kcalDePasos = (pasos, pesoKg) =>
  Math.round((Number(pasos) || 0) * 0.04 * ((Number(pesoKg) || 70) / 70));
const ANIMOS = [
  { level: 1, emoji: "😔", label: "Mal" },
  { level: 2, emoji: "😕", label: "Bajón" },
  { level: 3, emoji: "😐", label: "Normal" },
  { level: 4, emoji: "🙂", label: "Bien" },
  { level: 5, emoji: "😄", label: "Genial" },
];

// Metadatos del tipo de actividad (caminata/carrera/bici), para mostrar ícono y nombre.
const ACT_META = {
  caminata: { label: "Caminata", Icon: MdDirectionsWalk },
  carrera: { label: "Carrera", Icon: MdDirectionsRun },
  bici: { label: "Bici", Icon: MdDirectionsBike },
};
const actMeta = (t) => ACT_META[t] || ACT_META.caminata;
// Ícono del tipo de actividad como componente reutilizable.
function ActIcon({ tipo, className }) {
  const { Icon, label } = actMeta(tipo);
  return <Icon className={className} title={label} aria-label={label} />;
}

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

// Calendario de mes (popover) para saltar a cualquier fecha. Puntito en los días con datos.
function CalendarioWeb({ fechaSel, hoy, tieneDatos, onSelect, onClose }) {
  const [mes, setMes] = useState(() => {
    const d = new Date(`${fechaSel}T00:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const y = mes.getFullYear();
  const m = mes.getMonth();
  const pad = (n) => String(n).padStart(2, "0");
  const dim = new Date(y, m + 1, 0).getDate();
  const primerDow = (new Date(y, m, 1).getDay() + 6) % 7;
  const celdas = [...Array(primerDow).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  return createPortal(
    <div className={style.calOverlay} onClick={onClose}>
      <div className={style.calModal} onClick={(e) => e.stopPropagation()}>
        <div className={style.calHead}>
          <button type="button" onClick={() => setMes(new Date(y, m - 1, 1))} aria-label="Mes anterior">‹</button>
          <span>{mes.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</span>
          <button type="button" onClick={() => setMes(new Date(y, m + 1, 1))} aria-label="Mes siguiente">›</button>
        </div>
        <div className={style.calGrid}>
          {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
            <span key={`d${i}`} className={style.calDow}>{d}</span>
          ))}
          {celdas.map((d, i) => {
            if (d == null) return <span key={i} />;
            const k = `${y}-${pad(m + 1)}-${pad(d)}`;
            const futuro = k > hoy;
            const tiene = !futuro && tieneDatos && tieneDatos(k);
            const sel = k === fechaSel;
            return (
              <button
                key={i}
                type="button"
                disabled={futuro}
                className={`${style.calDiaBtn} ${sel ? style.calDiaSel : ""} ${k === hoy && !sel ? style.calDiaHoy : ""}`}
                onClick={() => onSelect(k)}
              >
                {d}
                {tiene ? <span className={style.calDotDia} /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Navegador de día (‹ Ayer ›) para ver el historial. La fecha abre un calendario.
function DateNav({ fecha, setFecha, hoy, tieneDatos }) {
  const [calOpen, setCalOpen] = useState(false);
  return (
    <>
      <div className={style.dateNav}>
        <button type="button" onClick={() => setFecha(addDays(fecha, -1))} aria-label="Día anterior">
          ‹
        </button>
        <button type="button" className={style.dateNavLabel} onClick={() => setCalOpen((v) => !v)}>
          <span>{fechaLabel(fecha, hoy)}</span>
          <FiCalendar className={style.dateNavCal} />
        </button>
        <button
          type="button"
          onClick={() => fecha < hoy && setFecha(addDays(fecha, 1))}
          disabled={fecha >= hoy}
          aria-label="Día siguiente"
        >
          ›
        </button>
      </div>
      {/* El calendario va FUERA del .dateNav: es un modal (overlay fijo) y así
          no hereda las reglas `.dateNav span/button` que le rompían la grilla. */}
      {calOpen ? (
        <CalendarioWeb
          fechaSel={fecha}
          hoy={hoy}
          tieneDatos={tieneDatos}
          onSelect={(k) => {
            setFecha(k);
            setCalOpen(false);
          }}
          onClose={() => setCalOpen(false)}
        />
      ) : null}
    </>
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

// Visor de recorridos GPS: dibuja el trazado de cada caminata en SVG (sin mapa,
// solo la forma del recorrido) + fecha/km. Trae la ruta de un endpoint aparte.
function RecorridosModalWeb({ hoy, onClose, onCaminatas }) {
  const [recorridos, setRecorridos] = useState(null); // null = cargando
  const [idx, setIdx] = useState(0);
  const [vista, setVista] = useState("uno"); // "uno" (un recorrido) | "calor" (heatmap)
  useEffect(() => {
    saludService
      .recorridos()
      .then(({ data }) => setRecorridos(data?.recorridos || []))
      .catch(() => setRecorridos([]));
  }, []);
  const sel = recorridos && recorridos[idx];

  const svg = useMemo(() => {
    if (!sel?.ruta || sel.ruta.length < 2) return null;
    const W = 560;
    const H = 360;
    const pad = 36;
    const lats = sel.ruta.map((p) => p.latitude);
    const lngs = sel.ruta.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180) || 1;
    const spanLng = (maxLng - minLng) * kx || 1e-6;
    const spanLat = maxLat - minLat || 1e-6;
    const scale = Math.min((W - 2 * pad) / spanLng, (H - 2 * pad) / spanLat);
    const offX = (W - spanLng * scale) / 2;
    const offY = (H - spanLat * scale) / 2;
    const pts = sel.ruta.map((p) => [
      offX + (p.longitude - minLng) * kx * scale,
      H - offY - (p.latitude - minLat) * scale,
    ]);
    const d = "M " + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ");
    return { W, H, d, pts, ini: pts[0], fin: pts[pts.length - 1] };
  }, [sel]);

  // Mapa de calor personal: proyecta TODOS los recorridos a un mismo SVG.
  // Al superponer líneas semi-transparentes, donde más pasás queda más brillante.
  const heat = useMemo(() => {
    const rutas = (recorridos || [])
      .map((r) => r.ruta)
      .filter((r) => Array.isArray(r) && r.length > 1);
    if (!rutas.length) return null;
    const W = 560;
    const H = 360;
    const pad = 30;
    const lats = rutas.flatMap((r) => r.map((p) => p.latitude));
    const lngs = rutas.flatMap((r) => r.map((p) => p.longitude));
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180) || 1;
    const spanLng = (maxLng - minLng) * kx || 1e-6;
    const spanLat = maxLat - minLat || 1e-6;
    const scale = Math.min((W - 2 * pad) / spanLng, (H - 2 * pad) / spanLat);
    const offX = (W - spanLng * scale) / 2;
    const offY = (H - spanLat * scale) / 2;
    const paths = rutas.map(
      (r) =>
        "M " +
        r
          .map((p) => {
            const x = offX + (p.longitude - minLng) * kx * scale;
            const y = H - offY - (p.latitude - minLat) * scale;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" L ")
    );
    return { W, H, paths };
  }, [recorridos]);

  const fechaCorta = (k) =>
    new Date(`${k}T00:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

  const [borrando, setBorrando] = useState(false);
  const borrar = () => {
    if (!sel || borrando) return;
    setBorrando(true);
    saludService
      .borrarRecorrido({ fecha: sel.fecha, metros: sel.metros, secs: sel.secs })
      .then(({ data }) => {
        const nuevos = data?.recorridos || [];
        setRecorridos(nuevos);
        setIdx((i) => Math.max(0, Math.min(i, nuevos.length - 1)));
        onCaminatas?.(data?.caminatas || []);
      })
      .catch(() => {})
      .finally(() => setBorrando(false));
  };

  // Replay animado del recorrido: la ruta se dibuja y un puntito la recorre.
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(1); // 0..1 (1 = ruta completa)
  useEffect(() => {
    // Al cambiar de recorrido: mostramos la ruta entera y frenamos el replay.
    setPlaying(false);
    setProgress(1);
  }, [idx, recorridos]);
  useEffect(() => {
    if (!playing) return undefined;
    let raf;
    let start = null;
    const DUR = 4200; // ms que dura el replay
    const step = (t) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / DUR);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(step);
      else setPlaying(false);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const reproducir = () => {
    if (!svg) return;
    setProgress(0);
    setPlaying(true);
  };
  const nPts = svg ? svg.pts.length : 0;
  const dotPos = nPts ? svg.pts[Math.min(nPts - 1, Math.round(progress * (nPts - 1)))] : null;

  return (
    <div className={style.recOverlay} onClick={onClose}>
      <div className={style.recModal} onClick={(e) => e.stopPropagation()}>
        <div className={style.recHead}>
          <h3>
            <FiMap /> Recorridos GPS
          </h3>
          <button type="button" className={style.recClose} onClick={onClose} aria-label="Cerrar">
            <FiX />
          </button>
        </div>
        {recorridos === null ? (
          <p className={style.hint}>Cargando recorridos…</p>
        ) : !recorridos.length ? (
          <p className={style.hint}>
            Todavía no tenés caminatas con recorrido. Se graban desde la app al caminar con GPS.
          </p>
        ) : (
          <>
            <div className={style.recVistaToggle}>
              <button
                type="button"
                className={vista === "uno" ? style.recVistaOn : style.recVistaOff}
                onClick={() => setVista("uno")}
              >
                Recorrido
              </button>
              <button
                type="button"
                className={vista === "calor" ? style.recVistaOn : style.recVistaOff}
                onClick={() => setVista("calor")}
              >
                Mapa de calor
              </button>
            </div>
            {vista === "calor" ? (
              <>
                <div className={style.recMapa}>
                  {heat ? (
                    <svg viewBox={`0 0 ${heat.W} ${heat.H}`} width="100%" preserveAspectRatio="xMidYMid meet">
                      {heat.paths.map((d, i) => (
                        <path
                          key={`g${i}`}
                          d={d}
                          fill="none"
                          stroke="var(--color-verde, #5dc72d)"
                          strokeOpacity="0.16"
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ))}
                      {heat.paths.map((d, i) => (
                        <path
                          key={`c${i}`}
                          d={d}
                          fill="none"
                          stroke="#7ee787"
                          strokeOpacity="0.42"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ))}
                    </svg>
                  ) : (
                    <p className={style.hint}>Sin recorridos con trazado para el mapa de calor.</p>
                  )}
                </div>
                <p className={style.recHeatHint}>
                  🔥 Se superponen tus {recorridos.length} recorridos: donde más pasás, más brillante.
                </p>
              </>
            ) : (
              <>
            <div className={style.recMapa}>
              {svg ? (
                <>
                  <svg viewBox={`0 0 ${svg.W} ${svg.H}`} width="100%" preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <linearGradient id="recRuta" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#7ee787" />
                        <stop offset="100%" stopColor="var(--color-verde, #5dc72d)" />
                      </linearGradient>
                    </defs>
                    {/* Traza completa, tenue, de fondo */}
                    <path
                      d={svg.d}
                      fill="none"
                      stroke="var(--color-verde, #5dc72d)"
                      strokeOpacity="0.22"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Traza que se dibuja según el progreso del replay */}
                    <path
                      d={svg.d}
                      pathLength="1"
                      fill="none"
                      stroke="url(#recRuta)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="1"
                      strokeDashoffset={1 - progress}
                    />
                    <circle cx={svg.ini[0]} cy={svg.ini[1]} r="8" fill="#fff" stroke="var(--color-verde, #5dc72d)" strokeWidth="3" />
                    {progress >= 1 ? (
                      <circle cx={svg.fin[0]} cy={svg.fin[1]} r="9" fill="var(--color-verde, #5dc72d)" stroke="#fff" strokeWidth="3" />
                    ) : dotPos ? (
                      <circle cx={dotPos[0]} cy={dotPos[1]} r="9" fill="var(--color-verde, #5dc72d)" stroke="#fff" strokeWidth="3" />
                    ) : null}
                  </svg>
                  <button
                    type="button"
                    className={style.recPlay}
                    onClick={reproducir}
                    disabled={playing}
                    aria-label="Reproducir recorrido"
                  >
                    <FiPlay /> {playing ? "Reproduciendo…" : "Reproducir"}
                  </button>
                </>
              ) : (
                <p className={style.hint}>Este recorrido no tiene trazado guardado.</p>
              )}
            </div>
            <div className={style.recInfo}>
              <div className={style.recInfoTxt}>
                <strong>{(sel.metros / 1000).toFixed(2)} km</strong>
                <span className={style.recInfoTipo}>
                  <ActIcon tipo={sel.tipo} className={style.recTipoIcon} /> {actMeta(sel.tipo).label} ·{" "}
                  {fechaLabel(sel.fecha, hoy)} · {Math.floor((sel.secs || 0) / 60)} min
                  {sel.kcal ? ` · ${sel.kcal} kcal` : ""}
                </span>
              </div>
              <button
                type="button"
                className={style.recBorrar}
                onClick={borrar}
                disabled={borrando}
                aria-label="Borrar este recorrido"
              >
                <FiTrash2 /> {borrando ? "Borrando…" : "Borrar"}
              </button>
            </div>
            <div className={style.recChips}>
              {recorridos.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  className={i === idx ? style.recChipOn : style.recChip}
                  onClick={() => setIdx(i)}
                >
                  <span>{fechaCorta(c.fecha)}</span>
                  <strong>{(c.metros / 1000).toFixed(1)} km</strong>
                </button>
              ))}
            </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Editor de la meta de calorías (mismo cálculo que la app). Guarda `nutri`.
function PlanModal({ initial, pesoSugerido, onClose, onGuardar }) {
  const [peso, setPeso] = useState(String(initial?.peso || (pesoSugerido ? Math.round(pesoSugerido) : 70)));
  const [altura, setAltura] = useState(String(initial?.altura || 170));
  const [edad, setEdad] = useState(String(initial?.edad || 30));
  const [sexo, setSexo] = useState(initial?.sexo || "H");
  const [actividad, setActividad] = useState(initial?.actividad || "ligero");
  const [objetivo, setObjetivo] = useState(initial?.objetivo || "mantener");
  const preview = calcularPlan({ peso, altura, edad, sexo, actividad, objetivo });
  const guardar = () => {
    onGuardar({
      peso: Number(peso),
      altura: Number(altura),
      edad: Number(edad),
      sexo,
      actividad,
      objetivo,
    });
    onClose();
  };
  return (
    <div className={style.planOverlay} onClick={onClose}>
      <div className={style.planModal} onClick={(e) => e.stopPropagation()}>
        <h3 className={style.planTitulo}>Tu meta de calorías</h3>
        <div className={style.planCampos}>
          <label className={style.planCampo}>
            Peso (kg)
            <input type="number" value={peso} onChange={(e) => setPeso(e.target.value)} />
          </label>
          <label className={style.planCampo}>
            Altura (cm)
            <input type="number" value={altura} onChange={(e) => setAltura(e.target.value)} />
          </label>
          <label className={style.planCampo}>
            Edad
            <input type="number" value={edad} onChange={(e) => setEdad(e.target.value)} />
          </label>
          <label className={style.planCampo}>
            Sexo
            <select value={sexo} onChange={(e) => setSexo(e.target.value)}>
              <option value="H">Hombre</option>
              <option value="M">Mujer</option>
            </select>
          </label>
        </div>
        <div className={style.planGrupo}>
          <span className={style.planGrupoLbl}>Actividad</span>
          <div className={style.planChips}>
            {ACTIVIDADES.map((a) => (
              <button
                key={a.key}
                type="button"
                className={actividad === a.key ? style.planChipOn : style.planChip}
                onClick={() => setActividad(a.key)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div className={style.planGrupo}>
          <span className={style.planGrupoLbl}>Objetivo</span>
          <div className={style.planChips}>
            {OBJETIVOS.map((o) => (
              <button
                key={o.key}
                type="button"
                className={objetivo === o.key ? style.planChipOn : style.planChip}
                onClick={() => setObjetivo(o.key)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className={style.planPreview}>
          {preview ? (
            <>
              Tu meta: <strong>{preview.kcal.toLocaleString("es-AR")}</strong> kcal/día · C{" "}
              {preview.carbG} · P {preview.protG} · G {preview.fatG} g
            </>
          ) : (
            "Completá peso, altura y edad."
          )}
        </div>
        <div className={style.planAcciones}>
          <button type="button" className={style.planCancel} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={style.planOk} onClick={guardar} disabled={!preview}>
            Guardar
          </button>
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
  const [planOpen, setPlanOpen] = useState(false); // editor de la meta de calorías
  const [recorridosOpen, setRecorridosOpen] = useState(false); // visor de recorridos GPS
  const [resumenPeriodo, setResumenPeriodo] = useState("semana"); // semana | mes | todo
  const [fNombre, setFNombre] = useState("");
  const [fKcal, setFKcal] = useState("");
  const [fCarb, setFCarb] = useState("");
  const [fProt, setFProt] = useState("");
  const [fFat, setFFat] = useState("");
  const [fCant, setFCant] = useState("1"); // cantidad (porciones o gramos según fModo; admite decimales)
  const [fUnidad, setFUnidad] = useState(""); // unidad de la porción (pote, puñado, cucharada…)
  const [fGramos, setFGramos] = useState(0); // gramos que pesa 1 porción (0 = desconocido)
  const [fModo, setFModo] = useState("porcion"); // "porcion" | "g"
  const [elegida, setElegida] = useState(false); // ya eligió/definió comida → paso 2 (cantidad)
  const [manual, setManual] = useState(false); // comida cargada a mano (no está en la base)
  const [editValores, setEditValores] = useState(false); // mostrar inputs kcal/C/P/G en paso 2
  const [sugAbierta, setSugAbierta] = useState(true); // dropdown de sugerencias visible
  const [onlineComidas, setOnlineComidas] = useState([]); // resultados de Open Food Facts

  const hoy = dayKey(new Date());
  const [fechaCal, setFechaCal] = useState(hoy); // día que se ve en Comidas
  const [fechaMov, setFechaMov] = useState(hoy); // día que se ve en Todos los resultados
  const [histTitulo, setHistTitulo] = useState(null); // métrica abierta en el historial completo

  useEffect(() => {
    // Mostramos al instante lo último cacheado (evita el "Cargando" en cada visita)
    // y refrescamos por detrás. La base gratis (Atlas M0) puede tardar el 1er request.
    try {
      const cache = localStorage.getItem("salud_cache_v1");
      if (cache) {
        setData(JSON.parse(cache));
        setCargando(false);
      }
    } catch {}
    saludService
      .get()
      .then(({ data: d }) => {
        setData(d);
        try {
          localStorage.setItem("salud_cache_v1", JSON.stringify(d));
        } catch {}
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  const mutate = async (partial) => {
    try {
      const { data: d } = await saludService.update(partial);
      setData(d);
    } catch {}
  };

  // Borra una caminata (queda tombstone en el backend: no vuelve con el re-sync).
  const borrarCaminata = async (c) => {
    try {
      const { data: d } = await saludService.borrarRecorrido({
        fecha: c.fecha,
        metros: c.metros,
        secs: c.secs,
      });
      setData((prev) => (prev ? { ...prev, caminatas: d.caminatas } : prev));
    } catch {}
  };

  const metaPasos = data?.metas?.pasos > 0 ? data.metas.pasos : 8000;
  const metaAgua = data?.metas?.agua > 0 ? data.metas.agua : 2000;
  // Pasos totales del día = sensor (del teléfono) + carga manual.
  const pasosDe = (k) => (Number(data?.pasos?.[k]) || 0) + (Number(data?.pasosManual?.[k]) || 0);
  const pasosHoy = pasosDe(hoy);

  // Peso actual (último registrado o el del plan) para estimar calorías de los pasos.
  const pesoKg = (() => {
    if (Number(data?.nutri?.peso) > 0) return Number(data.nutri.peso);
    const p = data?.peso || {};
    const ks = Object.keys(p).sort();
    return ks.length ? Number(p[ks[ks.length - 1]]) || 70 : 70;
  })();
  const kcalPasosHoy = kcalDePasos(pasosHoy, pesoKg);

  // Resumen de actividad (caminatas/carreras/salidas en bici) por período.
  const cutoffSemana = addDays(hoy, -6);
  const resumen = (data?.caminatas || [])
    .filter((c) => {
      if (resumenPeriodo === "todo") return true;
      if (resumenPeriodo === "mes") return String(c.fecha).slice(0, 7) === hoy.slice(0, 7);
      return c.fecha >= cutoffSemana; // semana: últimos 7 días
    })
    .reduce(
      (a, c) => {
        a.metros += Number(c.metros) || 0;
        a.secs += Number(c.secs) || 0;
        a.kcal += Number(c.kcal) || 0;
        a.count += 1;
        const t = c.tipo || "caminata";
        a.tipos[t] = (a.tipos[t] || 0) + 1;
        return a;
      },
      { metros: 0, secs: 0, kcal: 0, count: 0, tipos: {} }
    );

  // ¿Ese día tiene datos? (para el puntito del calendario)
  const tieneDatosMov = (k) =>
    pasosDe(k) > 0 ||
    (Number(data?.agua?.[k]) || 0) > 0 ||
    !!data?.animo?.[k] ||
    (Number(data?.peso?.[k]) || 0) > 0 ||
    (data?.comidas?.[k] || []).length > 0 ||
    (data?.caminatas || []).some((c) => c.fecha === k);
  const tieneDatosCal = (k) =>
    (data?.comidas?.[k] || []).length > 0 || (Number(data?.agua?.[k]) || 0) > 0;
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
        titulo: "Distancia (actividad)",
        color: "var(--color-verde, #5dc72d)",
        valor: (distDia(h) / 1000).toFixed(1).replace(".", ","),
        unidad: "km",
        barras: dias.map(distDia),
        getVal: (k) => distDia(k) / 1000,
        keys: keysCaminatas,
        fmt: (v) => v.toFixed(2).replace(".", ","),
      },
      {
        titulo: "Tiempo (actividad)",
        color: "var(--color-verde, #5dc72d)",
        valor: String(Math.round(minDia(h))),
        unidad: "min",
        barras: dias.map(minDia),
        getVal: (k) => minDia(k),
        keys: keysCaminatas,
        fmt: (v) => String(Math.round(v)),
      },
      {
        titulo: "Velocidad promedio",
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
    setManual(false);
    setEditValores(false);
    setElegida(true); // → paso 2
  };

  // Cargar una comida a mano (la que escribió no está en la base): paso 2 con los
  // campos de kcal/macros abiertos para completar.
  const activarManual = () => {
    setFKcal("");
    setFCarb("");
    setFProt("");
    setFFat("");
    setFUnidad("");
    setFGramos(0);
    setFModo("porcion");
    setFCant("1");
    setManual(true);
    setEditValores(true);
    setElegida(true); // → paso 2
  };

  // Volver del paso 2 (cantidad) al paso 1 (buscar).
  const volverABuscar = () => {
    setElegida(false);
    setManual(false);
    setEditValores(false);
    setSugAbierta(true);
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
    setManual(false);
    setEditValores(false);
    setSugAbierta(true);
  };

  const agregarComida = () => {
    if (!fNombre.trim() || kcalUnit <= 0 || cantNum <= 0) return;
    const base = fNombre.trim();
    let nombre = base;
    if (fModo === "g") nombre = `${base} · ${fmtCant(cantNum)} g`;
    else if (fUnidad) nombre = `${base} · ${fmtCant(cantNum)} ${fUnidad}`;
    else if (cantNum !== 1) nombre = `${base} · ${fmtCant(cantNum)} porciones`;
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
                    <ActIcon tipo={c.tipo} className={style.caminataTipo} />
                    <span>{c.fecha}</span>
                    <strong>{(c.metros / 1000).toFixed(2)} km</strong>
                    <span>{Math.floor((c.secs || 0) / 60)} min</span>
                    {c.kcal ? <span className={style.caminataKcal}>{c.kcal} kcal</span> : null}
                    <button
                      type="button"
                      className={style.caminataDel}
                      onClick={() => borrarCaminata(c)}
                      aria-label="Borrar caminata"
                      title="Borrar caminata"
                    >
                      <FiTrash2 />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={style.hint}>Todavía no registraste caminatas desde la app.</p>
            )}
          </section>
        </div>

        {/* Resumen de actividad (estilo diario de entrenamiento) */}
        <section className={`${style.card} ${style.cardFull}`}>
          <div className={style.cardHead}>
            <h2>
              <FiTrendingUp /> Resumen de actividad
              <FiInfo
                className={style.infoIcon}
                title="Distancia, tiempo y velocidad salen de las actividades con GPS que grabás desde la app (caminata, carrera o bici). Los pasos vienen del sensor del teléfono. Correr quema más calorías que caminar, por eso conviene elegir bien el tipo al grabar."
              />
            </h2>
            <span className={style.periodoToggle}>
              {[
                ["semana", "Semana"],
                ["mes", "Mes"],
                ["todo", "Todo"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  className={resumenPeriodo === k ? style.periodoOn : style.periodoOff}
                  onClick={() => setResumenPeriodo(k)}
                >
                  {l}
                </button>
              ))}
            </span>
          </div>
          {resumen.count ? (
            <>
              <div className={style.resumenTiles}>
                <div className={style.resTile}>
                  <strong>{(resumen.metros / 1000).toFixed(1)}</strong>
                  <small>km</small>
                </div>
                <div className={style.resTile}>
                  <strong>{Math.round(resumen.secs / 60)}</strong>
                  <small>min</small>
                </div>
                <div className={style.resTile}>
                  <strong>{resumen.kcal}</strong>
                  <small>kcal</small>
                </div>
                <div className={style.resTile}>
                  <strong>{resumen.count}</strong>
                  <small>{resumen.count === 1 ? "actividad" : "actividades"}</small>
                </div>
              </div>
              <div className={style.resumenTipos}>
                {["caminata", "carrera", "bici"]
                  .filter((t) => resumen.tipos[t])
                  .map((t) => (
                    <span key={t} className={style.resTipo}>
                      <ActIcon tipo={t} className={style.resTipoIcon} /> {resumen.tipos[t]} {actMeta(t).label}
                    </span>
                  ))}
              </div>
            </>
          ) : (
            <p className={style.hint}>Sin actividades en este período. Grabá una caminata desde la app.</p>
          )}
        </section>

        {/* Pasos de hoy — debajo de Caminatas (ambos vienen del teléfono). */}
        <div className={style.trioRow}>
          <section className={style.card}>
            <div className={style.cardHead}>
              <h2>
                <FiActivity /> Pasos de hoy
              </h2>
              <div className={style.pasosBtns}>
                <button
                  type="button"
                  className={style.pasosManualBtn}
                  title="Ver los recorridos de tus caminatas por GPS"
                  onClick={() => setRecorridosOpen(true)}
                >
                  <FiMap /> Recorridos
                </button>
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
            </div>
            <div className={style.fila}>
              <Ring percent={(pasosHoy / metaPasos) * 100} color="var(--color-verde, #5dc72d)">
                <strong>{pasosHoy.toLocaleString("es-AR")}</strong>
                <small>de {metaPasos.toLocaleString("es-AR")}</small>
                {kcalPasosHoy > 0 ? (
                  <small className={style.kcalPasos}>≈ {kcalPasosHoy} kcal 🔥</small>
                ) : null}
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
            <DateNav fecha={fechaMov} setFecha={setFechaMov} hoy={hoy} tieneDatos={tieneDatosMov} />
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
            <DateNav fecha={fechaCal} setFecha={setFechaCal} hoy={hoy} tieneDatos={tieneDatosCal} />
            <button type="button" className={style.planBtn} onClick={() => setPlanOpen(true)}>
              {plan ? (
                <>
                  Plan: <strong>{plan.kcal.toLocaleString("es-AR")}</strong> kcal · C {plan.carbG}g · P{" "}
                  {plan.protG}g · G {plan.fatG}g <span className={style.planEdit}>✎ editar</span>
                </>
              ) : (
                <>Configurá tu meta de calorías ✎</>
              )}
            </button>
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
                  <strong className={style.franjaLabel}>
                    <f.Icon className={style.franjaIcon} />
                    {f.label}
                  </strong>
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
                    {!elegida ? (
                      /* PASO 1 — buscar el alimento */
                      <>
                        <div className={style.nombreWrap}>
                          <input
                            value={fNombre}
                            onChange={(e) => {
                              setFNombre(e.target.value);
                              setSugAbierta(true);
                            }}
                            onFocus={() => setSugAbierta(true)}
                            onBlur={() => setTimeout(() => setSugAbierta(false), 150)}
                            placeholder="Buscá qué comiste…"
                            autoFocus
                          />
                          {sugAbierta && (sugerencias.length > 0 || fNombre.trim().length >= 2) ? (
                            <ul className={style.sugerencias}>
                              {sugerencias.map((s, i) => (
                                <li key={i}>
                                  <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => usarSugerencia(s)}
                                  >
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
                              {fNombre.trim().length >= 2 ? (
                                <li>
                                  <button
                                    type="button"
                                    className={style.cargarManualItem}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={activarManual}
                                  >
                                    <span className={style.sugIcono}>
                                      <FiPlus />
                                    </span>
                                    <span className={style.sugNombre}>Cargar “{fNombre.trim()}” a mano</span>
                                  </button>
                                </li>
                              ) : null}
                            </ul>
                          ) : null}
                        </div>
                        <div className={style.buscarAcciones}>
                          <span className={style.buscarHint}>Elegí de la lista o cargala a mano.</span>
                          <button type="button" className={style.comidaCancel} onClick={() => setFormFranja(null)}>
                            Cancelar
                          </button>
                        </div>
                      </>
                    ) : (
                      /* PASO 2 — cantidad y (opcional) editar valores */
                      <>
                        <div className={style.elegidoRow}>
                          <button type="button" className={style.cambiarBtn} onClick={volverABuscar}>
                            ‹ cambiar
                          </button>
                          {manual ? (
                            <input
                              className={style.nombreManual}
                              value={fNombre}
                              onChange={(e) => setFNombre(e.target.value)}
                              placeholder="Nombre de la comida"
                              autoFocus
                            />
                          ) : (
                            <span className={style.elegidoNombre}>{fNombre}</span>
                          )}
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
                            {fModo === "g" ? "g" : fUnidad || (cantNum === 1 ? "porción" : "porciones")}
                          </span>
                          <span className={style.cantChips}>
                            {(fModo === "g" ? ["50", "100", "150", "200"] : ["0.5", "1", "2"]).map((v) => (
                              <button key={v} type="button" className={style.cantChip} onClick={() => setFCant(v)}>
                                {v === "0.5" ? "½" : v}
                              </button>
                            ))}
                          </span>
                        </div>
                        {!manual && !fUnidad && fGramos === 0 && fNombre.trim() ? (
                          <span className={style.cantNota}>1 porción = «{fNombre}»</span>
                        ) : null}
                        {editValores ? (
                          <div className={style.macrosEdit}>
                            <input
                              type="number"
                              min="0"
                              value={fKcal}
                              onChange={(e) => setFKcal(e.target.value)}
                              placeholder={fUnidad ? `kcal x ${fUnidad}` : "kcal c/u"}
                              title="Calorías por porción"
                            />
                            <input type="number" min="0" value={fCarb} onChange={(e) => setFCarb(e.target.value)} placeholder="C g" title="Carbohidratos (g) por porción" />
                            <input type="number" min="0" value={fProt} onChange={(e) => setFProt(e.target.value)} placeholder="P g" title="Proteína (g) por porción" />
                            <input type="number" min="0" value={fFat} onChange={(e) => setFFat(e.target.value)} placeholder="G g" title="Grasa (g) por porción" />
                          </div>
                        ) : (
                          <button type="button" className={style.editValoresLink} onClick={() => setEditValores(true)}>
                            ✎ editar calorías y macros
                          </button>
                        )}
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
                              ? ` · ${fmtCant(cantNum)} porciones`
                              : ""}
                          </span>
                        ) : null}
                        <div className={style.servirAcciones}>
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
                      </>
                    )}
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

        {planOpen ? (
          <PlanModal
            initial={data?.nutri}
            pesoSugerido={pesoActual}
            onClose={() => setPlanOpen(false)}
            onGuardar={(nutri) => mutate({ nutri })}
          />
        ) : null}

        {recorridosOpen ? (
          <RecorridosModalWeb
            hoy={hoy}
            onClose={() => setRecorridosOpen(false)}
            onCaminatas={(cams) => setData((prev) => (prev ? { ...prev, caminatas: cams } : prev))}
          />
        ) : null}
      </div>
    </div>
  );
}
