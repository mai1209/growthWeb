import { useCallback, useEffect, useRef, useState } from "react";
import { FiCheck, FiChevronDown, FiEdit2, FiFeather, FiX } from "react-icons/fi";
import { journalService } from "../api";
import style from "../style/Journaling.module.css";

// Ánimo del día: 1 (muy mal) a 5 (muy bien).
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

// Color de cada nivel de ánimo (rojo → verde) para el gráfico.
const ANIMO_COLORS = { 1: "#e5484d", 2: "#e58a3a", 3: "#c9a23a", 4: "#8fbf3f", 5: "#14d95f" };

const ENTRADA_VACIA = { animo: 0, gratitud: "", mejor: "", distinto: "", libre: "" };

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

const emojiDe = (animo) => ANIMOS.find((a) => a.valor === Number(animo))?.emoji || "";

function Journaling() {
  const [fecha, setFecha] = useState(hoyLocal);
  const [entrada, setEntrada] = useState(ENTRADA_VACIA);
  const [historial, setHistorial] = useState([]);
  const [racha, setRacha] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [abierta, setAbierta] = useState(null); // fecha de la entrada expandida
  const [preguntas, setPreguntas] = useState(PREGUNTAS_DEFAULT);
  const [editandoPreguntas, setEditandoPreguntas] = useState(false);
  const [borradorPreguntas, setBorradorPreguntas] = useState(PREGUNTAS_DEFAULT);
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

  const elegirAnimo = (valor) => {
    // Tocar el mismo emoji lo desmarca.
    editar("animo", Number(entrada.animo) === valor ? 0 : valor);
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

  // Ánimo en el tiempo: historial (viejo → nuevo) + la entrada de hoy.
  const animoSerie = [...historial]
    .reverse()
    .concat(Number(entrada.animo) > 0 ? [{ fecha, animo: entrada.animo }] : [])
    .filter((e) => Number(e.animo) > 0)
    .slice(-30);

  if (cargando) {
    return <p className={style.cargando}>Cargando tu journal…</p>;
  }

  return (
    <div className={style.wrap}>
      <header className={style.header}>
        <div className={style.fechaBloque}>
          <FiFeather className={style.fechaIcono} />
          <span className={style.fecha}>{fechaLarga(fecha)}</span>
        </div>
        {racha > 0 ? (
          <span className={style.racha} title={`${racha} días seguidos escribiendo`}>
            🔥 {racha} {racha === 1 ? "día" : "días"}
          </span>
        ) : null}
      </header>

      {/* Ánimo */}
      <div className={style.animoBox}>
        <p className={style.animoLabel}>¿Cómo estuvo tu día?</p>
        <div className={style.animoRow}>
          {ANIMOS.map((a) => (
            <button
              key={a.valor}
              type="button"
              className={`${style.animoBtn} ${Number(entrada.animo) === a.valor ? style.animoActivo : ""}`}
              onClick={() => elegirAnimo(a.valor)}
              aria-label={`Ánimo ${a.valor} de 5`}
              aria-pressed={Number(entrada.animo) === a.valor}
            >
              {a.emoji}
            </button>
          ))}
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

      {/* Historial */}
      {historial.length > 0 ? (
        <div className={style.historial}>
          <p className={style.historialTitulo}>Entradas anteriores</p>
          {historial.map((e) => {
            const abiertaEsta = abierta === e.fecha;
            return (
              <div key={e.fecha} className={style.entrada}>
                <button
                  type="button"
                  className={style.entradaHead}
                  onClick={() => setAbierta(abiertaEsta ? null : e.fecha)}
                  aria-expanded={abiertaEsta}
                >
                  <span className={style.entradaEmoji}>{emojiDe(e.animo) || "·"}</span>
                  <span className={style.entradaFecha}>{fechaLarga(e.fecha)}</span>
                  <FiChevronDown
                    className={`${style.entradaChevron} ${abiertaEsta ? style.entradaChevronOpen : ""}`}
                  />
                </button>
                {abiertaEsta ? (
                  <div className={style.entradaBody}>
                    {CAMPOS.map((p) =>
                      e[p.campo] ? (
                        <div key={p.campo} className={style.entradaCampo}>
                          <span>{preguntas[p.campo]}</span>
                          <p>{e[p.campo]}</p>
                        </div>
                      ) : null
                    )}
                    {e.libre ? (
                      <div className={style.entradaCampo}>
                        <span>Notas libres</span>
                        <p>{e.libre}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default Journaling;
