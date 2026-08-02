import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiActivity,
  FiDroplet,
  FiHeart,
  FiNavigation,
  FiPlus,
  FiRefreshCw,
  FiSmile,
  FiTrendingUp,
  FiX,
} from "react-icons/fi";
import { saludService } from "../api";
import { calcularPlan } from "../utils/nutricion";
import style from "../style/Salud.module.css";

const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];
const FRANJAS = [
  { key: "desayuno", label: "Desayuno" },
  { key: "almuerzo", label: "Almuerzo" },
  { key: "cena", label: "Cena" },
  { key: "aperitivo", label: "Aperitivo" },
];
const ANIMOS = [
  { level: 1, emoji: "😔", label: "Mal" },
  { level: 2, emoji: "😕", label: "Bajón" },
  { level: 3, emoji: "😐", label: "Normal" },
  { level: 4, emoji: "🙂", label: "Bien" },
  { level: 5, emoji: "😄", label: "Genial" },
];

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

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

export default function SaludPage() {
  // El nav deep-linkea las dos vistas: /salud (Movilidad) y /salud?view=calorias.
  const [searchParams] = useSearchParams();
  const esCalorias = searchParams.get("view") === "calorias";
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [pesoInput, setPesoInput] = useState("");
  const [formFranja, setFormFranja] = useState(null); // franja abierta para agregar
  const [fNombre, setFNombre] = useState("");
  const [fKcal, setFKcal] = useState("");
  const [fCarb, setFCarb] = useState("");
  const [fProt, setFProt] = useState("");
  const [fFat, setFFat] = useState("");

  const hoy = dayKey(new Date());

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
  const pasosHoy = Number(data?.pasos?.[hoy]) || 0;
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

  const comidasHoy = data?.comidas?.[hoy] || [];
  const consumido = comidasHoy.reduce((a, c) => a + (Number(c.kcal) || 0), 0);
  const consCarb = comidasHoy.reduce((a, c) => a + (Number(c.carbG) || 0), 0);
  const consProt = comidasHoy.reduce((a, c) => a + (Number(c.protG) || 0), 0);
  const consFat = comidasHoy.reduce((a, c) => a + (Number(c.fatG) || 0), 0);

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
  };

  const agregarComida = () => {
    const k = parseInt(fKcal, 10) || 0;
    if (!fNombre.trim() || k <= 0) return;
    const item = {
      id: `${Date.now()}`,
      franja: formFranja,
      nombre: fNombre.trim(),
      kcal: k,
      carbG: parseInt(fCarb, 10) || 0,
      protG: parseInt(fProt, 10) || 0,
      fatG: parseInt(fFat, 10) || 0,
    };
    mutate({ comidas: { [hoy]: [...comidasHoy, item] } });
    setFormFranja(null);
  };

  const borrarComida = (id) => {
    mutate({ comidas: { [hoy]: comidasHoy.filter((c) => c.id !== id) } });
  };

  if (cargando) return <p className={style.cargando}>Cargando tu salud…</p>;

  return (
    <div className={style.wrap}>
      <header className={style.header}>
        <p className={style.kicker}>SALUD</p>
        <h1>{esCalorias ? "Calorías diarias" : "Movilidad"}</h1>
        <p className={style.subtitulo}>
          {esCalorias
            ? "Anotá tus comidas y mirá cuánto te queda del día."
            : "Los pasos y caminatas se miden desde el teléfono; lo demás también lo podés cargar acá."}
        </p>
      </header>

      <div className={style.grid}>
        {!esCalorias ? (
        <>
        {/* Pasos + Caminatas apilados en la misma columna (ambos del teléfono) */}
        <div className={style.colStack}>
        <section className={style.card}>
          <div className={style.cardHead}>
            <h2>
              <FiActivity /> Pasos de hoy
            </h2>
            <span className={style.badgeTel}>desde el teléfono</span>
          </div>
          <div className={style.fila}>
            <Ring percent={(pasosHoy / metaPasos) * 100} color="var(--color-verde, #5dc72d)">
              <strong>{pasosHoy.toLocaleString("es-AR")}</strong>
              <small>de {metaPasos.toLocaleString("es-AR")}</small>
            </Ring>
            <Semana
              dias={ultimos7.labels}
              valores={ultimos7.dias.map((k) => Number(data?.pasos?.[k]) || 0)}
              meta={metaPasos}
              color="var(--color-verde, #5dc72d)"
            />
          </div>
        </section>

        {/* Caminatas (solo lectura) */}
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

        {/* Hidratación (editable) */}
        <section className={style.card}>
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

        {/* Ánimo + Peso apilados en la misma columna */}
        <div className={style.colStack}>
        <section className={style.card}>
          <div className={style.cardHead}>
            <h2>
              <FiSmile /> ¿Cómo te sentís hoy?
            </h2>
          </div>
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
        </section>

        {/* Peso (editable) */}
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
                <p className={style.hint}>Registrá tu peso de hoy</p>
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
        </div>
        </>
        ) : (
        <>
        {/* Nutrición + comidas (editable) */}
        <section className={`${style.card} ${style.cardAncha}`}>
          <div className={style.cardHead}>
            <h2>
              <FiTrendingUp /> Comidas de hoy
            </h2>
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
            const items = comidasHoy.filter((c) => c.franja === f.key);
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
                    <input
                      value={fNombre}
                      onChange={(e) => setFNombre(e.target.value)}
                      placeholder="¿Qué comiste?"
                      autoFocus
                    />
                    <input
                      type="number"
                      min="0"
                      value={fKcal}
                      onChange={(e) => setFKcal(e.target.value)}
                      placeholder="kcal"
                    />
                    <input type="number" min="0" value={fCarb} onChange={(e) => setFCarb(e.target.value)} placeholder="C g" />
                    <input type="number" min="0" value={fProt} onChange={(e) => setFProt(e.target.value)} placeholder="P g" />
                    <input type="number" min="0" value={fFat} onChange={(e) => setFFat(e.target.value)} placeholder="G g" />
                    <button type="button" className={style.comidaOk} onClick={agregarComida}>
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
        </>
        )}
      </div>
    </div>
  );
}
