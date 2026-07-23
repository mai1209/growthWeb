import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiBookOpen,
  FiCalendar,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiEdit2,
  FiFeather,
  FiX,
} from "react-icons/fi";
import { journalService } from "../api";
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

// Color de cada nivel de ánimo (rojo → verde) para el gráfico y el calendario.
const ANIMO_COLORS = { 1: "#e5484d", 2: "#e58a3a", 3: "#c9a23a", 4: "#8fbf3f", 5: "#14d95f" };

const ENTRADA_VACIA = { animo: 0, gratitud: "", mejor: "", distinto: "", libre: "" };

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
  [e?.gratitud, e?.mejor, e?.distinto, e?.libre].some((c) => String(c || "").trim());

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
  const [vista, setVista] = useState("calendario"); // calendario | libro
  const [libroFecha, setLibroFecha] = useState(null); // página abierta del libro
  const [calRef, setCalRef] = useState(() => new Date());
  const guardadoRef = useRef(null);

  const aplicar = useCallback((data) => {
    setEntrada(data?.hoy ? { ...ENTRADA_VACIA, ...data.hoy } : ENTRADA_VACIA);
    setHistorial(Array.isArray(data?.entradas) ? data.entradas : []);
    setRacha(Number(data?.racha) || 0);
    if (data?.preguntas) setPreguntas({ ...PREGUNTAS_DEFAULT, ...data.preguntas });
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

  // Autoguardado, igual que Afirmaciones: sin botón de guardar.
  const guardarDiferido = useCallback(
    (proxima) => {
      if (guardadoRef.current) clearTimeout(guardadoRef.current);
      guardadoRef.current = setTimeout(async () => {
        setGuardando(true);
        try {
          const { data } = await journalService.save({ ...proxima, fecha });
          setHistorial(Array.isArray(data?.entradas) ? data.entradas : []);
          setRacha(Number(data?.racha) || 0);
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

  const editar = (campo, valor) => {
    setEntrada((prev) => {
      const proxima = { ...prev, [campo]: valor };
      guardarDiferido(proxima);
      return proxima;
    });
  };

  const guardarPreguntas = async () => {
    setEditandoPreguntas(false);
    try {
      const { data } = await journalService.savePreguntas(borradorPreguntas);
      if (data?.preguntas) setPreguntas({ ...PREGUNTAS_DEFAULT, ...data.preguntas });
    } catch {
      /* quedan las anteriores */
    }
  };

  // Todas las entradas con contenido (historial + la de hoy), viejo → nuevo.
  const entradas = useMemo(() => {
    const lista = [...historial].reverse();
    if (tieneContenido(entrada)) lista.push({ ...entrada, fecha });
    return lista;
  }, [historial, entrada, fecha]);

  const porFecha = useMemo(() => {
    const map = new Map();
    entradas.forEach((e) => map.set(e.fecha, e));
    return map;
  }, [entradas]);

  // Ánimo en el tiempo (últimos 30 días con ánimo marcado).
  const animoSerie = entradas.filter((e) => Number(e.animo) > 0).slice(-30);

  // Página abierta del libro: la elegida, o la última escrita.
  const libroIdx = useMemo(() => {
    if (!entradas.length) return -1;
    const idx = entradas.findIndex((e) => e.fecha === libroFecha);
    return idx >= 0 ? idx : entradas.length - 1;
  }, [entradas, libroFecha]);

  const abrirEnLibro = (f) => {
    setLibroFecha(f);
    setVista("libro");
  };

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
            return (
              <button
                key={key}
                type="button"
                className={`${style.calCell} ${d.getMonth() !== mesActual ? style.calCellFuera : ""} ${
                  esHoy ? style.calCellHoy : ""
                } ${e ? style.calCellConEntrada : ""}`}
                onClick={() => e && abrirEnLibro(key)}
                disabled={!e}
                title={e ? `Leer el ${fechaLarga(key)}` : undefined}
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
        <p className={style.calAyuda}>Los días con puntito tienen journaling: tocá uno para leerlo.</p>
      </div>
    );
  };

  /* ===== Vista libro ===== */
  const renderLibro = () => {
    if (libroIdx < 0) {
      return (
        <div className={style.libroVacio}>
          <FiBookOpen />
          <p>Todavía no hay páginas escritas. Lo que escribas hoy va a aparecer acá.</p>
        </div>
      );
    }

    const e = entradas[libroIdx];

    return (
      <div className={style.libroPage}>
        {racha > 0 ? (
          <span
            className={`${style.racha} ${style.rachaEnHoja}`}
            title={`${racha} días seguidos escribiendo`}
          >
            🔥 {racha} {racha === 1 ? "día" : "días"}
          </span>
        ) : null}
        <p className={style.libroFecha}>{fechaLarga(e.fecha)}</p>
        {Number(e.animo) > 0 ? <p className={style.libroAnimo}>{emojiDe(e.animo)}</p> : null}

        {CAMPOS.map((p) =>
          e[p.campo] ? (
            <div key={p.campo} className={style.libroBloque}>
              <p className={style.libroPregunta}>{preguntas[p.campo]}</p>
              <p className={style.libroTexto}>{e[p.campo]}</p>
            </div>
          ) : null
        )}
        {e.libre ? (
          <div className={style.libroBloque}>
            <p className={style.libroTexto}>{e.libre}</p>
          </div>
        ) : null}

        {/* Paginador dentro de la hoja, en tinta */}
        <div className={style.libroNav}>
          <button
            type="button"
            className={style.libroNavBtn}
            onClick={() => setLibroFecha(entradas[libroIdx - 1]?.fecha)}
            disabled={libroIdx <= 0}
            aria-label="Día anterior"
          >
            <FiChevronLeft />
          </button>
          <span className={style.libroPagina}>
            Página {libroIdx + 1} de {entradas.length}
          </span>
          <button
            type="button"
            className={style.libroNavBtn}
            onClick={() => setLibroFecha(entradas[libroIdx + 1]?.fecha)}
            disabled={libroIdx >= entradas.length - 1}
            aria-label="Día siguiente"
          >
            <FiChevronRight />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={style.wrap}>
      <header className={style.header}>
        <div className={style.fechaBloque}>
          <FiFeather className={style.fechaIcono} />
          <span className={style.fecha}>{fechaLarga(fecha)}</span>
        </div>
        <div className={style.vistaToggle} role="tablist" aria-label="Cómo ver tus entradas">
          <button
            type="button"
            className={`${style.vistaBtn} ${vista === "calendario" ? style.vistaBtnActivo : ""}`}
            onClick={() => setVista("calendario")}
            aria-pressed={vista === "calendario"}
          >
            <FiCalendar /> Vista calendario
          </button>
          <button
            type="button"
            className={`${style.vistaBtn} ${vista === "libro" ? style.vistaBtnActivo : ""}`}
            onClick={() => setVista("libro")}
            aria-pressed={vista === "libro"}
          >
            <FiBookOpen /> Vista libro
          </button>
        </div>
      </header>

      <div className={style.cols}>
        {/* Columna izquierda: escribir hoy */}
        <div className={style.colIzq}>
          <div className={style.animoBox}>
            <p className={style.animoLabel}>¿Cómo estuvo tu día?</p>
            {/* Extremos fijos; la carita del nivel actual viaja en el pulgar */}
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
                {/* Puntitos: acá cambia la cara */}
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
          </div>

          {/* Preguntas guiadas (el texto es personalizable) */}
          <div className={style.preguntasHead}>
            {editandoPreguntas ? (
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
                  setEditandoPreguntas(true);
                }}
                title="Cambiá el texto de las 3 preguntas por el tuyo"
              >
                <FiEdit2 /> Personalizar preguntas
              </button>
            )}
          </div>

          {CAMPOS.map((p) => (
            <label key={p.campo} className={style.campo}>
              {editandoPreguntas ? (
                <input
                  className={style.preguntaInput}
                  value={borradorPreguntas[p.campo]}
                  onChange={(e) =>
                    setBorradorPreguntas((prev) => ({ ...prev, [p.campo]: e.target.value }))
                  }
                  placeholder={PREGUNTAS_DEFAULT[p.campo]}
                  maxLength={90}
                />
              ) : (
                <span>{preguntas[p.campo]}</span>
              )}
              <textarea
                className={style.input}
                value={entrada[p.campo]}
                onChange={(e) => editar(p.campo, e.target.value)}
                placeholder={p.placeholder}
                rows={2}
                disabled={editandoPreguntas}
              />
            </label>
          ))}

          <label className={style.campo}>
            <span>Notas libres (opcional)</span>
            <textarea
              className={`${style.input} ${style.inputLibre}`}
              value={entrada.libre}
              onChange={(e) => editar("libre", e.target.value)}
              placeholder="Lo que quieras dejar escrito de hoy…"
              rows={4}
            />
          </label>

          <div className={style.pieGuardado}>{guardando ? "Guardando…" : ""}</div>

          {/* Ánimo en el tiempo */}
          {animoSerie.length >= 3 ? (
            <div className={style.animoChart}>
              <p className={style.historialTitulo}>Tu ánimo en el tiempo</p>
              <div className={style.chartBars} role="img" aria-label="Ánimo de los últimos días">
                {animoSerie.map((e) => (
                  <div
                    key={e.fecha}
                    className={style.chartBar}
                    style={{
                      height: `${(Number(e.animo) / 5) * 100}%`,
                      background: ANIMO_COLORS[Number(e.animo)] || "#5dc72d",
                    }}
                    title={`${fechaLarga(e.fecha)}: ${emojiDe(e.animo)}`}
                  />
                ))}
              </div>
              <div className={style.chartLeyenda}>
                <span>{fechaLarga(animoSerie[0].fecha)}</span>
                <span>hoy</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Columna derecha: releer (calendario o libro) */}
        <div className={style.colDer}>
          {vista === "calendario" ? renderCalendario() : renderLibro()}
        </div>
      </div>
    </div>
  );
}

export default Journaling;
