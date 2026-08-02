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
import style from "../style/Salud.module.css";

// Normaliza para comparar sin acentos ni mayúsculas.
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"];
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
  const [fCant, setFCant] = useState("1"); // cantidad (multiplica kcal y macros; admite decimales)
  const [fUnidad, setFUnidad] = useState(""); // unidad de la porción (pote, puñado, cucharada…)
  const [elegida, setElegida] = useState(false); // ya eligió sugerencia → ocultar lista

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

  // "Todos los resultados" (estilo Salud de iPhone): métricas derivadas.
  const metricas = useMemo(() => {
    if (!data) return [];
    const dias = ultimos7.dias;
    const h = dias[dias.length - 1];
    const kcalDia = (arr) => (arr || []).reduce((a, c) => a + (Number(c.kcal) || 0), 0);
    const camDia = (k) => (data.caminatas || []).filter((c) => c.fecha === k);
    const distDia = (k) => camDia(k).reduce((a, c) => a + (Number(c.metros) || 0), 0);
    const minDia = (k) => camDia(k).reduce((a, c) => a + (Number(c.secs) || 0), 0) / 60;
    const ultimaCam = (data.caminatas || [])[0];
    const velocidad =
      ultimaCam && ultimaCam.secs > 0 ? (ultimaCam.metros / 1000) / (ultimaCam.secs / 3600) : null;
    const pesoKeys = Object.keys(data.peso || {}).sort();
    const emojis = { 1: "😔", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };

    return [
      {
        titulo: "Pasos",
        color: "var(--color-verde, #5dc72d)",
        valor: (Number(data.pasos?.[h]) || 0).toLocaleString("es-AR"),
        unidad: "pasos",
        barras: dias.map((k) => Number(data.pasos?.[k]) || 0),
      },
      {
        titulo: "Distancia de caminata",
        color: "var(--color-verde, #5dc72d)",
        valor: (distDia(h) / 1000).toFixed(1).replace(".", ","),
        unidad: "km",
        barras: dias.map(distDia),
      },
      {
        titulo: "Tiempo de caminata",
        color: "var(--color-verde, #5dc72d)",
        valor: String(Math.round(minDia(h))),
        unidad: "min",
        barras: dias.map(minDia),
      },
      {
        titulo: "Velocidad al caminar",
        color: "var(--color-verde, #5dc72d)",
        valor: velocidad != null ? velocidad.toFixed(1).replace(".", ",") : "—",
        unidad: "km/h",
        barras: (data.caminatas || [])
          .slice(0, 7)
          .reverse()
          .map((c) => (c.secs > 0 ? (c.metros / 1000) / (c.secs / 3600) : 0)),
      },
      {
        titulo: "Hidratación",
        color: "#3aa0e0",
        valor: String(Number(data.agua?.[h]) || 0),
        unidad: "ml",
        barras: dias.map((k) => Number(data.agua?.[k]) || 0),
      },
      {
        titulo: "Calorías consumidas",
        color: "#e0703f",
        valor: String(kcalDia(data.comidas?.[h])),
        unidad: "kcal",
        barras: dias.map((k) => kcalDia(data.comidas?.[k])),
      },
      {
        titulo: "Ánimo",
        color: "#d6a92e",
        valor: data.animo?.[h] ? emojis[data.animo[h]] : "—",
        unidad: data.animo?.[h] ? "hoy" : "sin registrar",
        barras: dias.map((k) => Number(data.animo?.[k]) || 0),
      },
      {
        titulo: "Peso",
        color: "var(--color-verde, #5dc72d)",
        valor: pesoKeys.length ? String(data.peso[pesoKeys[pesoKeys.length - 1]]).replace(".", ",") : "—",
        unidad: "kg",
        barras: pesoKeys.slice(-7).map((k) => Number(data.peso[k]) || 0),
      },
    ];
  }, [data, ultimos7]);

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

  const sugerencias = useMemo(() => {
    const q = norm(fNombre);
    if (elegida || q.length < 2) return [];
    const delHistorial = historial.filter((h) => norm(h.nombre).includes(q));
    const deLaBase = BASE_COMIDAS.filter(
      (b) => norm(b.nombre).includes(q) && !delHistorial.some((h) => norm(h.nombre) === norm(b.nombre))
    );
    return [...delHistorial, ...deLaBase].slice(0, 6);
  }, [fNombre, historial, elegida]);

  const usarSugerencia = (s) => {
    setFNombre(s.nombre);
    setFKcal(String(s.kcal || ""));
    setFCarb(String(s.carbG || ""));
    setFProt(String(s.protG || ""));
    setFFat(String(s.fatG || ""));
    setFUnidad(s.unidad || "");
    setElegida(true);
  };

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
    setFCant("1");
    setFUnidad("");
    setElegida(false);
  };

  const agregarComida = () => {
    const k = parseInt(fKcal, 10) || 0;
    if (!fNombre.trim() || k <= 0) return;
    const cant = parseFloat(String(fCant).replace(",", ".")) || 1;
    const factor = cant > 0 ? cant : 1;
    const base = fNombre.trim();
    let nombre = base;
    if (fUnidad) nombre = `${base} · ${fmtCant(cant)} ${fUnidad}`;
    else if (cant !== 1) nombre = `${base} ×${fmtCant(cant)}`;
    const item = {
      id: `${Date.now()}`,
      franja: formFranja,
      nombre,
      kcal: Math.round(k * factor),
      carbG: Math.round((parseInt(fCarb, 10) || 0) * factor),
      protG: Math.round((parseInt(fProt, 10) || 0) * factor),
      fatG: Math.round((parseInt(fFat, 10) || 0) * factor),
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
        </div>

        {/* Todos los resultados (estilo Salud de iPhone) */}
        <section className={`${style.card} ${style.cardAncha}`}>
          <div className={style.cardHead}>
            <h2>Todos los resultados</h2>
          </div>
          <div className={style.datosGrid}>
            {metricas.map((m) => (
              <div key={m.titulo} className={style.dato}>
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
              </div>
            ))}
          </div>
        </section>
        </>
        ) : (
        <>
        <div className={style.calWrap}>
        {/* Nutrición + comidas (editable) */}
        <section className={`${style.card} ${style.calMain}`}>
          <div className={style.cardHead}>
            <h2>
              <FiTrendingUp /> Comidas de hoy
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
                    <div className={style.nombreWrap}>
                      <input
                        value={fNombre}
                        onChange={(e) => {
                          setFNombre(e.target.value);
                          setElegida(false);
                          setFUnidad("");
                        }}
                        placeholder="¿Qué comiste?"
                        autoFocus
                      />
                      {sugerencias.length > 0 ? (
                        <ul className={style.sugerencias}>
                          {sugerencias.map((s, i) => (
                            <li key={i}>
                              <button type="button" onClick={() => usarSugerencia(s)}>
                                <span className={style.sugIcono}>{s.propia ? "⏱" : "🍽"}</span>
                                <span className={style.sugNombre}>
                                  {s.nombre}
                                  {s.unidad ? <em className={style.sugUnidad}> · {s.unidad}</em> : null}
                                </span>
                                <span className={style.sugKcal}>{s.kcal} kcal</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className={style.cantWrap}>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={fCant}
                        onChange={(e) => setFCant(e.target.value)}
                        className={style.cantInput}
                        title="Cantidad"
                      />
                      <span className={style.cantUnidad}>{fUnidad || "u."}</span>
                      <span className={style.cantChips}>
                        {["0.5", "1", "2"].map((v) => (
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
                    />
                    <input type="number" min="0" value={fCarb} onChange={(e) => setFCarb(e.target.value)} placeholder="C g" title="Carbohidratos (g)" />
                    <input type="number" min="0" value={fProt} onChange={(e) => setFProt(e.target.value)} placeholder="P g" title="Proteína (g)" />
                    <input type="number" min="0" value={fFat} onChange={(e) => setFFat(e.target.value)} placeholder="G g" title="Grasa (g)" />
                    <button
                      type="button"
                      className={style.comidaOk}
                      onClick={agregarComida}
                      disabled={!fNombre.trim() || (parseInt(fKcal, 10) || 0) <= 0}
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
      </div>
    </div>
  );
}
