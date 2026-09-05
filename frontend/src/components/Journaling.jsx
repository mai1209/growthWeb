import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiBarChart2,
  FiBookOpen,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiEdit2,
  FiFeather,
  FiGrid,
  FiPlus,
  FiShare2,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { FiHelpCircle } from "react-icons/fi";
import { journalService } from "../api";
import JournalAyuda from "./JournalAyuda";
import style from "../style/Journaling.module.css";

// Ánimo del día: 1 (muy mal) a 5 (muy bien). El 0 (sin marcar) muestra la
// carita neutra sin boca en el pulgar.
const CARA_VACIA = "😶";
const ANIMOS = [
  { valor: 1, emoji: "😞" },
  { valor: 2, emoji: "😕" },
  { valor: 3, emoji: "😐" },
  { valor: 4, emoji: "🙂" },
  { valor: 5, emoji: "😄" },
];

// Texto del ánimo según la carita (se autoescribe al lado en el libro).
const ANIMO_LABELS = {
  1: "triste",
  2: "medio bajón",
  3: "indiferente",
  4: "contento",
  5: "feliz",
};

// Preguntas guiadas estilo "5 minute journal". El texto de cada una es
// personalizable; estos son los defaults y los placeholders.
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

// Estilos de papel de la hoja (preferencia local del navegador)
const PAPEL_ESTILOS = [
  { id: "crema", nombre: "Crema", fondo: "#faf5e9" },
  { id: "blanco", nombre: "Blanco", fondo: "#ffffff" },
  { id: "rosa", nombre: "Rosa", fondo: "#fbeef0" },
  { id: "celeste", nombre: "Celeste", fondo: "#eaf3f8" },
  { id: "verde", nombre: "Verde", fondo: "#eef6e4" },
];

// Textarea sin bordes que crece con el contenido: se escribe "sobre el papel".
function AutoTextarea({ value, onChange, placeholder, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoCapitalize="sentences"
    />
  );
}

// Plantillas de preguntas por nivel/tema (arranque para quien no sabe qué
// poner; igual se pueden editar o reemplazar). Cada una llena las 3 base y
// suma alguna extra.
const PLANTILLAS = [
  {
    id: "introspeccion",
    nivel: "Básico",
    tema: "Introspección",
    hint: "Conocerte un poco más cada día",
    base: {
      gratitud: "¿Cómo me siento hoy y por qué?",
      mejor: "¿Qué fue lo más importante que me pasó hoy?",
      distinto: "¿Qué necesito hoy que no me estoy dando?",
    },
    extras: ["¿Por qué estoy agradecido/a hoy?"],
  },
  {
    id: "estoicismo",
    nivel: "Intermedio",
    tema: "Estoicismo",
    hint: "Lo que controlás, la virtud, el presente",
    base: {
      gratitud: "¿Qué estuvo bajo mi control hoy y qué no?",
      mejor: "¿Actué con virtud o me dominó la emoción?",
      distinto: "¿Qué obstáculo de hoy puedo volver aprendizaje?",
    },
    extras: ["Si hoy fuera mi último día, ¿lo viví bien?"],
  },
  {
    id: "productividad",
    nivel: "Avanzado",
    tema: "Productividad",
    hint: "Foco, ejecución y mejora continua",
    base: {
      gratitud: "¿Cuál fue mi tarea más importante y la completé?",
      mejor: "¿Qué me dio impulso y qué me frenó hoy?",
      distinto: "¿Qué voy a hacer distinto mañana?",
    },
    extras: ["¿Cuál es la única cosa que hará que mañana valga la pena?"],
  },
];

// Color de cada nivel de ánimo (rojo → verde) para el gráfico y el calendario.
const ANIMO_COLORS = { 1: "#e5484d", 2: "#e58a3a", 3: "#c9a23a", 4: "#8fbf3f", 5: "#14d95f" };

const ENTRADA_VACIA = { animo: 0, gratitud: "", mejor: "", distinto: "", libre: "", preguntas: {}, extras: [] };

let extraSeq = 0;
const nuevoId = () => `x${Date.now().toString(36)}${(extraSeq++).toString(36)}`;

// Capitaliza la primera letra de cada oración mientras escribís (como en Notas):
// solo actúa sobre el caracter recién tipeado si arranca oración (inicio, o tras . ! ? o salto de línea).
const autoCapitalizar = (oldVal, newVal, caret) => {
  if (newVal.length !== (oldVal ? oldVal.length : 0) + 1) return newVal; // solo 1 char tipeado (no pegado)
  const i = caret - 1;
  if (i < 0 || i >= newVal.length) return newVal;
  const ch = newVal[i];
  const up = ch.toUpperCase();
  if (up === ch) return newVal; // no es letra minúscula
  const before = newVal.slice(0, i).replace(/[^\S\n]+$/, ""); // recorta espacios/tabs, no saltos
  const arranca = before === "" || /[.!?\n]$/.test(before);
  if (!arranca) return newVal;
  return newVal.slice(0, i) + up + newVal.slice(i + 1);
};

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

const pad = (n) => String(n).padStart(2, "0");

const hoyLocal = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const dayKeyOf = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

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

const fechaLarga = (fecha) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const emojiDe = (animo) => ANIMOS.find((a) => a.valor === Number(animo))?.emoji || "";

const tieneContenido = (e) =>
  Number(e?.animo) > 0 ||
  [e?.gratitud, e?.mejor, e?.distinto, e?.libre].some((c) => String(c || "").trim()) ||
  (Array.isArray(e?.extras) && e.extras.some((x) => String(x?.valor || "").trim()));

function Journaling() {
  const [fecha, setFecha] = useState(hoyLocal);
  const [entrada, setEntrada] = useState(ENTRADA_VACIA);
  const [historial, setHistorial] = useState([]);
  const [racha, setRacha] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [preguntas, setPreguntas] = useState(PREGUNTAS_DEFAULT);
  const [editandoPreguntas, setEditandoPreguntas] = useState(false);
  const [borradorPreguntas, setBorradorPreguntas] = useState(PREGUNTAS_DEFAULT);
  const [extras, setExtras] = useState([]); // definiciones [{id, texto}]
  const [borradorExtras, setBorradorExtras] = useState([]);
  const [plantillasOpen, setPlantillasOpen] = useState(false);
  const [metricasOpen, setMetricasOpen] = useState(false);
  const [ayudaOpen, setAyudaOpen] = useState(false);
  const [calRef, setCalRef] = useState(() => new Date());
  // Estilo del papel de la hoja (se recuerda en este navegador)
  const [papelEstilo, setPapelEstilo] = useState(() => {
    try {
      return localStorage.getItem("gw-journal-papel") || "crema";
    } catch {
      return "crema";
    }
  });
  const elegirPapel = (id) => {
    setPapelEstilo(id);
    try {
      localStorage.setItem("gw-journal-papel", id);
    } catch {}
  };
  const guardadoRef = useRef(null);

  const aplicar = useCallback((data) => {
    setEntrada(data?.hoy ? { ...ENTRADA_VACIA, ...data.hoy } : ENTRADA_VACIA);
    setHistorial(Array.isArray(data?.entradas) ? data.entradas : []);
    setRacha(Number(data?.racha) || 0);
    if (data?.preguntas) setPreguntas({ ...PREGUNTAS_DEFAULT, ...data.preguntas });
    setExtras(Array.isArray(data?.extras) ? data.extras : []);
  }, []);

  useEffect(() => {
    journalService
      .get(fecha)
      .then(({ data }) => aplicar(data))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [fecha, aplicar]);

  // Si la pestaña cruza la medianoche, refrescamos el día.
  useEffect(() => {
    const revisar = () => setFecha((prev) => (prev === hoyLocal() ? prev : hoyLocal()));
    window.addEventListener("focus", revisar);
    const timer = setInterval(revisar, 60000);
    return () => {
      window.removeEventListener("focus", revisar);
      clearInterval(timer);
    };
  }, []);

  // Al pararse en un día viejo se cierra el editor: las preguntas sólo se
  // cambian desde hoy (y no deben tocar los días ya respondidos).
  useEffect(() => {
    if (fecha !== hoyLocal()) setEditandoPreguntas(false);
  }, [fecha]);

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
    pendienteRef.current[campo] = valor;
    setEntrada((prev) => ({ ...prev, [campo]: valor }));
    guardarDiferido();
  };

  // onChange que capitaliza el inicio de oración y mantiene el cursor donde estaba.
  const onCap = (oldVal, aplicar) => (e) => {
    const el = e.target;
    const caret = el.selectionStart;
    const capped = autoCapitalizar(oldVal, el.value, caret);
    aplicar(capped);
    if (capped !== el.value && el.setSelectionRange) {
      requestAnimationFrame(() => {
        try {
          el.setSelectionRange(caret, caret);
        } catch {}
      });
    }
  };

  const valorExtra = (id) => (entrada.extras || []).find((x) => x.id === id)?.valor || "";

  const editarExtra = (id, valor) => {
    const def = extras.find((x) => x.id === id);
    const cur = entrada.extras || [];
    const existe = cur.some((x) => x.id === id);
    const list = existe
      ? cur.map((x) => (x.id === id ? { ...x, texto: def?.texto || x.texto, valor } : x))
      : [...cur, { id, texto: def?.texto || "", valor }];
    pendienteRef.current.extras = list;
    setEntrada((prev) => ({ ...prev, extras: list }));
    guardarDiferido();
  };

  // Aplica un set de preguntas (base + extras). Optimista: actualiza en
  // pantalla al instante y persiste; así guarda a la primera.
  const aplicarPreguntas = async (base, extrasLista) => {
    const limpio = (extrasLista || [])
      .map((x) => ({ id: x.id || nuevoId(), texto: String(x.texto || "").trim() }))
      .filter((x) => x.texto);
    setPreguntas({ ...PREGUNTAS_DEFAULT, ...base });
    setExtras(limpio);
    setEditandoPreguntas(false);
    try {
      // Siempre se estampan en HOY: cambiar preguntas nunca reescribe días viejos.
      const { data } = await journalService.savePreguntas({ ...base, extras: limpio, fecha: hoyLocal() });
      if (data?.preguntas) setPreguntas({ ...PREGUNTAS_DEFAULT, ...data.preguntas });
      if (Array.isArray(data?.extras)) setExtras(data.extras);
    } catch {
      /* quedó lo optimista; se reintenta al volver a guardar */
    }
  };

  const guardarPreguntas = () => aplicarPreguntas(borradorPreguntas, borradorExtras);

  const aplicarPlantilla = (pl) => {
    setPlantillasOpen(false);
    aplicarPreguntas(pl.base, pl.extras.map((texto) => ({ id: nuevoId(), texto })));
  };

  // Detecta qué plantilla coincide con las preguntas actuales (para marcarla).
  const plantillaActivaId = (() => {
    const eq = (a, b) => String(a || "").trim() === String(b || "").trim();
    const found = PLANTILLAS.find(
      (pl) =>
        eq(pl.base.gratitud, preguntas.gratitud) &&
        eq(pl.base.mejor, preguntas.mejor) &&
        eq(pl.base.distinto, preguntas.distinto) &&
        pl.extras.length === extras.length &&
        pl.extras.every((t, i) => eq(t, extras[i]?.texto))
    );
    return found?.id || null;
  })();

  // Guarda ya lo pendiente (antes de cambiar de día) y navega a otro día.
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

  const irADia = async (f) => {
    if (!f) return;
    if (f !== fecha) {
      await flushGuardado();
      setFecha(f);
    }
  };

  // Todas las entradas: historial (otros días con contenido) + el día activo
  // en vivo (aunque esté vacío, para poder verlo y editarlo). Viejo → nuevo.
  const entradas = useMemo(() => {
    const map = new Map();
    historial.filter(tieneContenido).forEach((e) => map.set(e.fecha, e));
    map.set(fecha, { ...entrada, fecha });
    // Hoy siempre es una página navegable del libro, aunque esté vacío: así
    // desde cualquier día viejo la flecha "siguiente" te devuelve a hoy para
    // poder escribir (antes hoy se caía del libro y quedabas trabado en ayer).
    const hoy = hoyLocal();
    if (!map.has(hoy)) map.set(hoy, { ...ENTRADA_VACIA, fecha: hoy });
    return [...map.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [historial, entrada, fecha]);

  const porFecha = useMemo(() => {
    const map = new Map();
    entradas.forEach((e) => map.set(e.fecha, e));
    return map;
  }, [entradas]);

  // Ánimo en el tiempo (últimos 30 días con ánimo marcado).
  const animoSerie = entradas.filter((e) => Number(e.animo) > 0).slice(-30);

  // La página del libro es el día activo (el que se está editando).
  const libroIdx = useMemo(
    () => entradas.findIndex((e) => e.fecha === fecha),
    [entradas, fecha]
  );

  // Preguntas a mostrar de una entrada: el día activo usa las actuales;
  // los días viejos usan el snapshot que quedó guardado ese día.
  const preguntasVista = (e) => {
    if (e.fecha === fecha) return preguntas;
    const snap = e.preguntas || {};
    // Días viejos sin snapshot propio caen al DEFAULT (no a las preguntas
    // actuales): así cambiar las preguntas hoy nunca reescribe los días viejos.
    return {
      gratitud: snap.gratitud || PREGUNTAS_DEFAULT.gratitud,
      mejor: snap.mejor || PREGUNTAS_DEFAULT.mejor,
      distinto: snap.distinto || PREGUNTAS_DEFAULT.distinto,
    };
  };

  // ¿El día activo es hoy? Sólo hoy se pueden cambiar las preguntas/plantilla.
  const esHoy = fecha === hoyLocal();
  // Preguntas y extras del día que se está editando: hoy usa la config actual;
  // un día viejo usa su snapshot congelado (así editar hoy no lo reescribe).
  const preguntasActivas = esHoy
    ? preguntas
    : {
        gratitud: entrada.preguntas?.gratitud || PREGUNTAS_DEFAULT.gratitud,
        mejor: entrada.preguntas?.mejor || PREGUNTAS_DEFAULT.mejor,
        distinto: entrada.preguntas?.distinto || PREGUNTAS_DEFAULT.distinto,
      };
  const extrasActivos = esHoy
    ? extras
    : (entrada.extras || []).map((x) => ({ id: x.id, texto: x.texto }));

  // (Las "páginas internas" con columnas desaparecieron: ahora se escribe
  // directamente sobre la hoja y esta crece con el contenido.)

  if (cargando) {
    return <p className={style.cargando}>Cargando tu journal…</p>;
  }

  /* ===== Vista calendario ===== */
  const renderCalendario = () => {
    const cells = buildMonthGrid(calRef);
    const mesLabel = calRef.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    const mesActual = calRef.getMonth();
    const hoy = hoyLocal();

    return (
      <div className={style.calBox}>
        <div className={style.calNav}>
          <div className={style.calNavGrupo}>
            <button
              type="button"
              className={style.calNavBtn}
              onClick={() => setCalRef(new Date(calRef.getFullYear(), calRef.getMonth() - 1, 1))}
              aria-label="Mes anterior"
            >
              <FiChevronLeft />
            </button>
            <span className={style.calMes}>{mesLabel}</span>
            <button
              type="button"
              className={style.calNavBtn}
              onClick={() => setCalRef(new Date(calRef.getFullYear(), calRef.getMonth() + 1, 1))}
              aria-label="Mes siguiente"
            >
              <FiChevronRight />
            </button>
          </div>
          {racha > 0 ? (
            <span className={style.racha} title={`${racha} días seguidos escribiendo`}>
              🔥 {racha} {racha === 1 ? "día" : "días"}
            </span>
          ) : null}
        </div>

        <div className={style.calWeekdays}>
          {WEEKDAYS.map((d, i) => (
            <span key={`${d}-${i}`}>{d}</span>
          ))}
        </div>

        <div className={style.calGrid}>
          {cells.map((d) => {
            const key = dayKeyOf(d);
            const e = porFecha.get(key);
            const esHoy = key === hoy;
            const esFuturo = key > hoy;
            return (
              <button
                key={key}
                type="button"
                className={`${style.calCell} ${d.getMonth() !== mesActual ? style.calCellFuera : ""} ${
                  esHoy ? style.calCellHoy : ""
                } ${e ? style.calCellConEntrada : ""} ${key === fecha ? style.calCellActiva : ""}`}
                onClick={() => irADia(key)}
                disabled={esFuturo}
                title={e ? `Abrir el ${fechaLarga(key)}` : `Escribir el ${fechaLarga(key)}`}
              >
                <span>{d.getDate()}</span>
                {e ? (
                  <i
                    className={style.calDot}
                    style={{ background: ANIMO_COLORS[Number(e.animo)] || "#5dc72d" }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        <p className={style.calAyuda}>Tocá cualquier día para abrirlo y escribir; el puntito marca los que ya tienen algo.</p>
      </div>
    );
  };

  /* ===== Vista libro ===== */
  // Pantalla de métricas del ánimo: caritas + gráfico, se abre con el botón
  // "Métricas" del header (reemplaza al libro/calendario en la columna derecha).
  const renderMetricas = () => {
    const serie = animoSerie;
    if (serie.length < 1) {
      return (
        <div className={style.metricasVacio}>
          <FiBarChart2 />
          <p>Marcá tu ánimo unos días y acá vas a ver cómo venís.</p>
        </div>
      );
    }
    const LABELS = { 1: "muy bajo", 2: "bajo", 3: "normal", 4: "bien", 5: "muy bien" };
    const promedio =
      serie.reduce((acc, e) => acc + Number(e.animo), 0) / serie.length;
    const prom = Math.max(1, Math.min(5, Math.round(promedio)));
    const distrib = [5, 4, 3, 2, 1].map((v) => ({
      v,
      count: serie.filter((e) => Number(e.animo) === v).length,
    }));
    const maxCount = Math.max(1, ...distrib.map((d) => d.count));

    return (
      <div className={style.metricasPanel}>
        <div className={style.metricasHead}>
          <span className={style.metricasEmojiBig}>{emojiDe(prom)}</span>
          <div>
            <p className={style.metricasTitulo}>Tu ánimo en el tiempo</p>
            <p className={style.metricasSub}>
              {serie.length} {serie.length === 1 ? "día" : "días"} · promedio {LABELS[prom]}
            </p>
          </div>
        </div>

        {/* Cuánto se repite cada carita */}
        <div className={style.metricasDist}>
          {distrib.map((d) => (
            <div key={d.v} className={style.metricasDistRow}>
              <span className={style.metricasCara}>{emojiDe(d.v)}</span>
              <div className={style.metricasBarTrack}>
                <div
                  className={style.metricasBarFill}
                  style={{
                    width: `${(d.count / maxCount) * 100}%`,
                    background: ANIMO_COLORS[d.v],
                  }}
                />
              </div>
              <span className={style.metricasCount}>{d.count}</span>
            </div>
          ))}
        </div>

        {/* Serie temporal, cada día con su carita */}
        <p className={style.metricasSecTit}>Últimos días</p>
        <div className={style.metricasSerie}>
          {serie.map((e) => (
            <div
              key={e.fecha}
              className={style.metricasDia}
              title={`${fechaLarga(e.fecha)}: ${emojiDe(e.animo)}`}
            >
              <div className={style.metricasColTrack}>
                <div
                  className={style.metricasCol}
                  style={{
                    height: `${(Number(e.animo) / 5) * 100}%`,
                    background: ANIMO_COLORS[Number(e.animo)],
                  }}
                />
              </div>
              <span className={style.metricasDiaCara}>{emojiDe(e.animo)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ¿Hay al menos una hoja escrita para exportar?
  const hayPaginasEscritas =
    historial.some(tieneContenido) || tieneContenido(entrada);

  // Descarga todas las hojas escritas como un PDF con estilo de libro/diario:
  // papel crema, renglones, línea de margen coral, marco y portada.
  const descargarPDF = async () => {
    const { jsPDF } = await import("jspdf");

    const mapa = new Map();
    historial.filter(tieneContenido).forEach((e) => mapa.set(e.fecha, e));
    if (tieneContenido(entrada)) mapa.set(fecha, { ...entrada, fecha });
    const hojas = [...mapa.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (!hojas.length) return;

    const doc = new jsPDF({ unit: "pt", format: "a5" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    // Paleta "papel"
    const PAPEL = [250, 245, 233];
    const MARCO = [205, 178, 138];
    const MARGEN = [201, 108, 86];
    const RENGLON = [230, 221, 201];
    const TINTA = [44, 38, 32];
    const TINTA_SUAVE = [122, 108, 94];
    const FECHA_TINTA = [58, 45, 36];
    const PREGUNTA = [76, 112, 32];

    const PAD = 26;
    const CX = 54;
    const CR = W - 40;
    const maxW = CR - CX;
    const LH = 19;
    const rulesTop = 96;
    const rulesBottom = H - 56;

    const fechaCorta = (f) => {
      const [y, m, d] = f.split("-");
      return `${d}/${m}/${y}`;
    };
    const animoColor = (v) =>
      v <= 2 ? [201, 108, 86] : v === 3 ? [212, 162, 72] : [124, 162, 72];

    const fondoHoja = () => {
      doc.setFillColor(...PAPEL);
      doc.rect(0, 0, W, H, "F");
      doc.setDrawColor(...RENGLON);
      doc.setLineWidth(0.5);
      for (let yy = rulesTop; yy <= rulesBottom; yy += LH) doc.line(CX - 8, yy, CR, yy);
      doc.setDrawColor(...MARGEN);
      doc.setLineWidth(1);
      doc.line(CX - 14, PAD + 6, CX - 14, H - PAD - 6);
      doc.setDrawColor(...MARCO);
      doc.setLineWidth(0.8);
      doc.rect(PAD, PAD, W - PAD * 2, H - PAD * 2);
    };

    // ---- Portada ----
    doc.setFillColor(...PAPEL);
    doc.rect(0, 0, W, H, "F");
    doc.setDrawColor(...MARCO);
    doc.setLineWidth(1.4);
    doc.rect(PAD, PAD, W - PAD * 2, H - PAD * 2);
    doc.setLineWidth(0.6);
    doc.rect(PAD + 6, PAD + 6, W - (PAD + 6) * 2, H - (PAD + 6) * 2);

    doc.setFont("times", "italic");
    doc.setFontSize(13);
    doc.setTextColor(...TINTA_SUAVE);
    doc.text("mi", W / 2, H * 0.4, { align: "center" });
    doc.setFont("times", "bold");
    doc.setFontSize(34);
    doc.setTextColor(...FECHA_TINTA);
    doc.text("Journaling", W / 2, H * 0.4 + 34, { align: "center" });

    const dy = H * 0.4 + 62;
    doc.setDrawColor(...MARCO);
    doc.setLineWidth(0.8);
    doc.line(W / 2 - 62, dy, W / 2 - 12, dy);
    doc.line(W / 2 + 12, dy, W / 2 + 62, dy);
    doc.setFillColor(...MARGEN);
    doc.triangle(W / 2 - 5, dy, W / 2 + 5, dy, W / 2, dy - 6, "F");
    doc.triangle(W / 2 - 5, dy, W / 2 + 5, dy, W / 2, dy + 6, "F");

    doc.setFont("times", "normal");
    doc.setFontSize(12);
    doc.setTextColor(...TINTA);
    const rango =
      hojas.length > 1
        ? `${fechaCorta(hojas[0].fecha)}   —   ${fechaCorta(hojas[hojas.length - 1].fecha)}`
        : fechaCorta(hojas[0].fecha);
    doc.text(rango, W / 2, dy + 28, { align: "center" });
    doc.setFontSize(10);
    doc.setTextColor(...TINTA_SUAVE);
    doc.text(
      `${hojas.length} ${hojas.length === 1 ? "hoja" : "hojas"}`,
      W / 2,
      dy + 46,
      { align: "center" }
    );
    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.text("Growth", W / 2, H - PAD - 16, { align: "center" });

    // ---- Hojas ----
    hojas.forEach((e, idx) => {
      doc.addPage();
      fondoHoja();

      doc.setFont("times", "bold");
      doc.setFontSize(15);
      doc.setTextColor(...FECHA_TINTA);
      doc.text(fechaLarga(e.fecha), CX - 8, 64);

      if (Number(e.animo) > 0) {
        const label = ANIMO_LABELS[Number(e.animo)] || "";
        doc.setFont("times", "normal");
        doc.setFontSize(9.5);
        const tw = doc.getTextWidth(label) + 20;
        const cx0 = CR - tw;
        const cy0 = 50;
        doc.setFillColor(...animoColor(Number(e.animo)));
        doc.roundedRect(cx0, cy0, tw, 16, 8, 8, "F");
        doc.setTextColor(45, 40, 30);
        doc.text(label, cx0 + tw / 2, cy0 + 11, { align: "center" });
      }

      doc.setDrawColor(...MARCO);
      doc.setLineWidth(0.6);
      doc.line(CX - 8, 76, CR, 76);

      let y = rulesTop - 3;
      const salto = () => {
        doc.addPage();
        fondoHoja();
        y = rulesTop - 3;
      };
      const bloque = (titulo, texto) => {
        if (!String(texto || "").trim()) return;
        if (titulo) {
          doc.setFont("times", "bolditalic");
          doc.setFontSize(11);
          doc.setTextColor(...PREGUNTA);
          doc.splitTextToSize(titulo, maxW).forEach((ln) => {
            if (y + LH > rulesBottom) salto();
            doc.text(ln, CX, y);
            y += LH;
          });
        }
        doc.setFont("times", "normal");
        doc.setFontSize(12);
        doc.setTextColor(...TINTA);
        doc.splitTextToSize(texto, maxW).forEach((ln) => {
          if (y + LH > rulesBottom) salto();
          doc.text(ln, CX, y);
          y += LH;
        });
        y += LH * 0.5;
      };

      const preg = preguntasVista(e);
      CAMPOS.forEach((p) => bloque(preg[p.campo], e[p.campo]));
      (e.extras || []).forEach((x) => bloque(x.texto, x.valor));
      if (e.libre) bloque(null, e.libre);

      doc.setFont("times", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...TINTA_SUAVE);
      doc.text(String(idx + 1), W / 2, H - PAD - 12, { align: "center" });
    });

    doc.save("mi-journaling.pdf");
  };

  // Comparte el día activo como texto (share nativo del sistema o portapapeles)
  const compartirDia = async () => {
    const partes = [`Journaling — ${fechaLarga(fecha)}`];
    if (Number(entrada.animo) > 0) {
      partes.push(`Ánimo: ${emojiDe(entrada.animo)} ${ANIMO_LABELS[Number(entrada.animo)] || ""}`);
    }
    CAMPOS.forEach((p) => {
      if (String(entrada[p.campo] || "").trim()) {
        partes.push(`${preguntasActivas[p.campo]}\n${entrada[p.campo]}`);
      }
    });
    (entrada.extras || []).forEach((x) => {
      if (String(x.valor || "").trim()) partes.push(`${x.texto}\n${x.valor}`);
    });
    if (String(entrada.libre || "").trim()) partes.push(entrada.libre);
    const texto = partes.join("\n\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: "Mi journaling", text: texto });
      } else {
        await navigator.clipboard.writeText(texto);
        window.alert("Copiado al portapapeles ✅");
      }
    } catch {
      /* compartir cancelado */
    }
  };

  return (
    <div className={style.wrap}>
      <header className={style.header}>
        <div className={style.fechaBloque}>
          <FiFeather className={style.fechaIcono} />
          <span className={style.fecha}>Journaling</span>
          {racha > 0 ? (
            <span className={style.racha} title={`${racha} días seguidos escribiendo`}>
              Racha de 🔥 {racha} {racha === 1 ? "día" : "días"}
            </span>
          ) : null}
        </div>
        <div className={style.headerAcciones}>
          <button type="button" className={style.ayudaLink} onClick={() => setAyudaOpen(true)}>
            <FiHelpCircle /> Sugerencias de preguntas
          </button>

          {/* Personalizar preguntas (sólo hoy) */}
          {esHoy ? (
            editandoPreguntas ? (
              <>
                <button type="button" className={style.preguntasBtn} onClick={guardarPreguntas}>
                  <FiCheck /> Guardar preguntas
                </button>
                <button
                  type="button"
                  className={style.preguntasBtn}
                  onClick={() => setEditandoPreguntas(false)}
                >
                  <FiX /> Cancelar
                </button>
              </>
            ) : (
              <button
                type="button"
                className={style.preguntasBtn}
                onClick={() => {
                  setBorradorPreguntas(preguntas);
                  setBorradorExtras(extras.map((x) => ({ ...x })));
                  setEditandoPreguntas(true);
                }}
                title="Cambiá tus preguntas o agregá más"
              >
                <FiEdit2 /> Personalizar
              </button>
            )
          ) : null}

          {/* Plantillas de preguntas por nivel (sólo hoy) */}
          {esHoy ? (
          <div className={style.plantillasWrap}>
            <button
              type="button"
              className={`${style.plantillasBtn} ${plantillasOpen ? style.plantillasBtnOpen : ""}`}
              onClick={() => setPlantillasOpen((prev) => !prev)}
              aria-expanded={plantillasOpen}
            >
              <FiGrid /> Plantillas
              <FiChevronDown
                className={`${style.plantillasChevron} ${plantillasOpen ? style.plantillasChevronOpen : ""}`}
              />
            </button>
            {plantillasOpen ? (
              <>
                <div
                  className={style.plantillasBackdrop}
                  onClick={() => setPlantillasOpen(false)}
                  role="presentation"
                />
                <div className={style.plantillasMenu} role="menu">
                  <p className={style.plantillasTitulo}>Elegí un set de preguntas</p>
                  {PLANTILLAS.map((pl) => (
                    <button
                      key={pl.id}
                      type="button"
                      className={`${style.plantillaItem} ${
                        pl.id === plantillaActivaId ? style.plantillaItemActivo : ""
                      }`}
                      onClick={() => aplicarPlantilla(pl)}
                      role="menuitem"
                    >
                      <span className={style.plantillaTextos}>
                        <span className={style.plantillaNivel}>{pl.nivel}</span>
                        <span className={style.plantillaTema}>{pl.tema}</span>
                        <span className={style.plantillaHint}>{pl.hint}</span>
                      </span>
                      {pl.id === plantillaActivaId ? (
                        <FiCheck className={style.plantillaCheck} />
                      ) : null}
                    </button>
                  ))}
                  <p className={style.plantillasPie}>
                    Después las podés editar o escribir las tuyas.
                  </p>
                </div>
              </>
            ) : null}
          </div>
          ) : null}
        </div>
      </header>

      <div className={style.cols}>
        {/* La hoja: se escribe DIRECTAMENTE sobre el papel (lo que ves es lo
            que se exporta). */}
        <div className={style.colIzq}>
          <div className={`${style.hoja} ${style[`papel_${papelEstilo}`] || ""}`}>
            <div className={style.hojaHead}>
              <h2 className={style.hojaTitulo}>{fechaLarga(fecha)}</h2>
              {fecha !== hoyLocal() ? (
                <button type="button" className={style.hoyBtn} onClick={() => irADia(hoyLocal())}>
                  Volver a hoy
                </button>
              ) : null}
            </div>

            {/* Ánimo del día, sobre el papel */}
            <div className={style.hojaAnimo}>
              <p className={style.hojaPregunta}>
                {esHoy ? "¿Cómo te sentís hoy?" : "¿Cómo me sentí ese día?"}
              </p>
              <div className={style.animoSliderRow}>
                <div className={style.animoSliderWrap}>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="1"
                    value={Number(entrada.animo) || 0}
                    onChange={(e) => editar("animo", Number(e.target.value))}
                    className={style.animoSlider}
                    style={{
                      background: `linear-gradient(to right, #5dc72d ${
                        ((Number(entrada.animo) || 0) / 5) * 100
                      }%, rgba(127, 137, 129, 0.3) ${((Number(entrada.animo) || 0) / 5) * 100}%)`,
                    }}
                    aria-label="Ánimo del día (0 sin marcar, 5 muy bien)"
                  />
                  {[1, 2, 3, 4, 5].map((v) => (
                    <i
                      key={v}
                      className={style.animoTick}
                      style={{ left: `calc(${(v / 5) * 100}% - ${(v / 5) * 30}px + 15px)` }}
                      aria-hidden="true"
                    />
                  ))}
                  <span
                    className={style.animoThumb}
                    style={{
                      left: `calc(${((Number(entrada.animo) || 0) / 5) * 100}% - ${
                        ((Number(entrada.animo) || 0) / 5) * 30
                      }px)`,
                    }}
                    aria-hidden="true"
                  >
                    {Number(entrada.animo) > 0 ? emojiDe(entrada.animo) : CARA_VACIA}
                  </span>
                </div>
              </div>
              {Number(entrada.animo) > 0 ? (
                <p className={style.hojaAnimoTexto}>
                  {esHoy ? "Hoy me siento" : "Me sentí"}{" "}
                  {ANIMO_LABELS[Number(entrada.animo)] || ""}
                </p>
              ) : null}
            </div>

            {editandoPreguntas && esHoy ? (
              <div className={style.editorPreguntas}>
                {CAMPOS.map((p) => (
                  <input
                    key={p.campo}
                    className={style.preguntaInput}
                    value={borradorPreguntas[p.campo]}
                    onChange={(e) =>
                      setBorradorPreguntas((prev) => ({ ...prev, [p.campo]: e.target.value }))
                    }
                    placeholder={PREGUNTAS_DEFAULT[p.campo]}
                    maxLength={200}
                  />
                ))}
                {borradorExtras.map((x) => (
                  <div key={x.id} className={style.extraEditRow}>
                    <input
                      className={style.preguntaInput}
                      value={x.texto}
                      onChange={(e) =>
                        setBorradorExtras((prev) =>
                          prev.map((it) => (it.id === x.id ? { ...it, texto: e.target.value } : it))
                        )
                      }
                      placeholder="Tu pregunta…"
                      maxLength={200}
                    />
                    <button
                      type="button"
                      className={style.extraDelBtn}
                      onClick={() =>
                        setBorradorExtras((prev) => prev.filter((it) => it.id !== x.id))
                      }
                      aria-label="Quitar pregunta"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={style.agregarPreguntaBtn}
                  onClick={() => setBorradorExtras((prev) => [...prev, { id: nuevoId(), texto: "" }])}
                >
                  <FiPlus /> Agregar pregunta
                </button>
              </div>
            ) : (
              <>
                {CAMPOS.map((p) => (
                  <div key={p.campo} className={style.hojaBloque}>
                    <p className={style.hojaPregunta}>{preguntasActivas[p.campo]}</p>
                    <AutoTextarea
                      className={style.hojaInput}
                      value={entrada[p.campo]}
                      onChange={onCap(entrada[p.campo], (v) => editar(p.campo, v))}
                      placeholder={p.placeholder}
                    />
                  </div>
                ))}
                {extrasActivos.map((x) => (
                  <div key={x.id} className={style.hojaBloque}>
                    <p className={style.hojaPregunta}>{x.texto}</p>
                    <AutoTextarea
                      className={style.hojaInput}
                      value={valorExtra(x.id)}
                      onChange={onCap(valorExtra(x.id), (v) => editarExtra(x.id, v))}
                      placeholder="Escribí tu respuesta…"
                    />
                  </div>
                ))}
                <div className={style.hojaBloque}>
                  <p className={style.hojaPregunta}>Notas libres</p>
                  <AutoTextarea
                    className={`${style.hojaInput} ${style.hojaInputLibre}`}
                    value={entrada.libre}
                    onChange={onCap(entrada.libre, (v) => editar("libre", v))}
                    placeholder="Lo que quieras dejar escrito de este día…"
                  />
                </div>
              </>
            )}

            {/* Pie de la hoja: navegar entre días + estado de guardado */}
            <div className={style.hojaPie}>
              <button
                type="button"
                className={style.hojaNavBtn}
                onClick={() => irADia(entradas[libroIdx - 1]?.fecha)}
                disabled={libroIdx <= 0}
                aria-label="Día anterior"
              >
                <FiChevronLeft />
              </button>
              <span className={style.hojaPagina}>
                Página {libroIdx + 1} de {entradas.length}
              </span>
              <button
                type="button"
                className={style.hojaNavBtn}
                onClick={() => irADia(entradas[libroIdx + 1]?.fecha)}
                disabled={libroIdx >= entradas.length - 1}
                aria-label="Día siguiente"
              >
                <FiChevronRight />
              </button>
              <span className={style.hojaGuardado}>
                {guardando ? "Guardando…" : "Guardado ✓"}
              </span>
            </div>
          </div>
        </div>

        {/* Panel derecho: calendario + acciones (como el mockup) */}
        <div className={style.colDer}>
          {renderCalendario()}

          <div className={style.railCard}>
            <button
              type="button"
              className={style.railBtn}
              onClick={compartirDia}
              disabled={!tieneContenido(entrada)}
            >
              <FiShare2 /> Compartir
            </button>
            <button
              type="button"
              className={style.railBtn}
              onClick={descargarPDF}
              disabled={!hayPaginasEscritas}
            >
              <FiDownload /> Exportar (PDF)
            </button>
            <div className={style.papelRow}>
              <span className={style.papelLabel}>Estilos de papel</span>
              <div className={style.papelSwatches}>
                {PAPEL_ESTILOS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`${style.papelSwatch} ${
                      papelEstilo === p.id ? style.papelSwatchOn : ""
                    }`}
                    style={{ background: p.fondo }}
                    onClick={() => elegirPapel(p.id)}
                    title={`Papel ${p.nombre}`}
                    aria-label={`Papel ${p.nombre}`}
                  />
                ))}
              </div>
            </div>
            <button
              type="button"
              className={`${style.railBtn} ${metricasOpen ? style.railBtnOn : ""}`}
              onClick={() => setMetricasOpen((prev) => !prev)}
            >
              <FiBarChart2 /> Métricas de ánimo
            </button>
          </div>

          {metricasOpen ? <div className={style.railCard}>{renderMetricas()}</div> : null}
        </div>
      </div>

      {ayudaOpen ? <JournalAyuda onClose={() => setAyudaOpen(false)} /> : null}
    </div>
  );
}

export default Journaling;
