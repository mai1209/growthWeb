import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiActivity,
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiTrash2,
  FiCheck,
  FiEdit2,
  FiX,
} from "react-icons/fi";
import { gymService } from "../api";
import { EJERCICIOS_BASE } from "../utils/ejerciciosBase";
import style from "../style/Gym.module.css";

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (key, delta) => {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
};
const hoyKey = () => dayKey(new Date());
const fechaLabel = (key) => {
  const hoy = hoyKey();
  if (key === hoy) return "Hoy";
  if (key === addDays(hoy, -1)) return "Ayer";
  return new Date(`${key}T00:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" });
};
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
const uid = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

export default function GymView() {
  const [data, setData] = useState({ ejercicios: [], rutinas: [], entrenos: {} });
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState("registro"); // registro | rutinas | progreso
  const [fecha, setFecha] = useState(hoyKey());
  const timerRef = useRef(null);

  useEffect(() => {
    gymService
      .get()
      .then(({ data: d }) => {
        setData({ ejercicios: d?.ejercicios || [], rutinas: d?.rutinas || [], entrenos: d?.entrenos || {} });
        // Sin rutinas todavía → arrancamos en el paso 1 (creá tu rutina).
        if (!(d?.rutinas || []).length) setTab("rutinas");
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  // Empuja al backend con un pequeño debounce (evita spamear al tipear).
  const push = (partial) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      gymService.update(partial).catch(() => {});
    }, 500);
  };

  const dia = data.entrenos[fecha] || [];

  const guardarDia = (nuevoDia) => {
    setData((prev) => ({ ...prev, entrenos: { ...prev.entrenos, [fecha]: nuevoDia } }));
    push({ entrenos: { [fecha]: nuevoDia } });
  };

  const guardarRutinas = (rutinas) => {
    setData((prev) => ({ ...prev, rutinas }));
    push({ rutinas });
  };

  // ------- Autocompletado de ejercicios (base + propios + historial) -------
  const historialEj = useMemo(() => {
    const map = new Map();
    Object.values(data.entrenos || {}).forEach((arr) => {
      (arr || []).forEach((e) => {
        const k = norm(e.nombre);
        if (k && !map.has(k)) map.set(k, { nombre: e.nombre, grupo: e.grupo || "" });
      });
    });
    return [...map.values()];
  }, [data.entrenos]);

  const buscarEjercicios = (q) => {
    const nq = norm(q);
    if (nq.length < 1) return EJERCICIOS_BASE.slice(0, 8);
    const propios = [...historialEj, ...(data.ejercicios || [])];
    const dePropios = propios.filter((e) => norm(e.nombre).includes(nq));
    const deBase = EJERCICIOS_BASE.filter(
      (e) => (norm(e.nombre).includes(nq) || norm(e.grupo).includes(nq)) && !dePropios.some((p) => norm(p.nombre) === norm(e.nombre))
    );
    return [...dePropios, ...deBase].slice(0, 8);
  };

  // ------- Acciones del registro del día -------
  const agregarEjercicio = (ej) => {
    const item = { id: uid(), nombre: ej.nombre, grupo: ej.grupo || "", sets: [{ kg: 0, reps: 0, hecha: false }] };
    guardarDia([...dia, item]);
  };
  const borrarEjercicio = (id) => guardarDia(dia.filter((e) => e.id !== id));
  const editarSets = (id, sets) => guardarDia(dia.map((e) => (e.id === id ? { ...e, sets } : e)));

  const usarRutina = (rutina) => {
    const nuevos = (rutina.ejercicios || []).map((e) => ({
      id: uid(),
      nombre: e.nombre,
      grupo: e.grupo || "",
      // El peso de la rutina viene precargado; en el entrenamiento lo ajustás si hace falta.
      sets: Array.from({ length: Math.max(1, e.series || 1) }, () => ({ kg: e.kg || 0, reps: e.reps || 0, hecha: false })),
    }));
    guardarDia([...dia, ...nuevos]);
  };

  if (cargando) return <p className={style.cargando}>Cargando tu gym…</p>;

  return (
    <div className={style.wrap}>
      <header className={style.header}>
        <h1>
          <FiActivity /> Gym
        </h1>
        <div className={style.tabs}>
          {[
            { k: "rutinas", label: "1 · Creá tu rutina" },
            { k: "registro", label: "2 · Entrenar" },
            { k: "progreso", label: "Progreso" },
          ].map((t) => (
            <button key={t.k} type="button" className={tab === t.k ? style.tabOn : style.tabOff} onClick={() => setTab(t.k)}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {tab === "registro" ? (
        <Registro
          dia={dia}
          fecha={fecha}
          setFecha={setFecha}
          buscarEjercicios={buscarEjercicios}
          agregarEjercicio={agregarEjercicio}
          borrarEjercicio={borrarEjercicio}
          editarSets={editarSets}
          rutinas={data.rutinas}
          usarRutina={usarRutina}
          entrenos={data.entrenos}
        />
      ) : tab === "rutinas" ? (
        <Rutinas rutinas={data.rutinas} guardarRutinas={guardarRutinas} buscarEjercicios={buscarEjercicios} />
      ) : (
        <Progreso entrenos={data.entrenos} />
      )}
    </div>
  );
}

/* ============================ Calendario ============================ */
// Mini calendario: los días con entrenamiento llevan un puntito; tocás un día
// y abajo se muestra (o completás) el entreno de ese día.
function MiniCalendario({ fecha, setFecha, entrenos }) {
  const [mes, setMes] = useState(() => {
    const d = new Date(`${fecha}T00:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const hoy = hoyKey();
  const y = mes.getFullYear();
  const m = mes.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  const primerDow = (new Date(y, m, 1).getDay() + 6) % 7; // lunes = 0
  const celdas = [...Array(primerDow).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  const esMesActual = hoy.startsWith(`${y}-${pad(m + 1)}`);

  return (
    <div className={style.cal}>
      <div className={style.calHead}>
        <button type="button" onClick={() => setMes(new Date(y, m - 1, 1))} aria-label="Mes anterior">
          <FiChevronLeft />
        </button>
        <span>{mes.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</span>
        <button type="button" disabled={esMesActual} onClick={() => setMes(new Date(y, m + 1, 1))} aria-label="Mes siguiente">
          <FiChevronRight />
        </button>
      </div>
      <div className={style.calGrid}>
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <span key={`d${i}`} className={style.calDow}>
            {d}
          </span>
        ))}
        {celdas.map((d, i) => {
          if (d == null) return <span key={i} />;
          const k = `${y}-${pad(m + 1)}-${pad(d)}`;
          const tiene = (entrenos[k] || []).length > 0;
          const sel = k === fecha;
          const futuro = k > hoy;
          return (
            <button
              key={i}
              type="button"
              disabled={futuro}
              className={`${style.calDia} ${sel ? style.calDiaSel : ""}`}
              onClick={() => setFecha(k)}
            >
              {d}
              {tiene ? <span className={style.calDot} /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ Registro ============================ */
function Registro({ dia, fecha, setFecha, buscarEjercicios, agregarEjercicio, borrarEjercicio, editarSets, rutinas, usarRutina, entrenos }) {
  const [agregando, setAgregando] = useState(false);
  const [q, setQ] = useState("");
  const [eligiendoRutina, setEligiendoRutina] = useState(false);
  const sugerencias = agregando ? buscarEjercicios(q) : [];

  const totalSeries = dia.reduce((a, e) => a + e.sets.filter((s) => s.hecha).length, 0);
  const sinEntreno = dia.length === 0;

  return (
    <>
      <MiniCalendario fecha={fecha} setFecha={setFecha} entrenos={entrenos} />

      <div className={style.dayBar}>
        <span className={style.diaSel}>{fechaLabel(fecha)}</span>
        {dia.length ? (
          <span className={style.resumenDia}>{totalSeries} series hechas</span>
        ) : null}
      </div>

      {/* Día vacío: el entrenamiento arranca eligiendo una rutina (o vacío). */}
      {sinEntreno && !agregando ? (
        <div className={style.entrenarHero}>
          {!eligiendoRutina ? (
            <>
              <p className={style.vacio}>Todavía no entrenaste este día.</p>
              <button type="button" className={style.entrenarBtn} onClick={() => setEligiendoRutina(true)}>
                Entrenar
              </button>
            </>
          ) : (
            <div className={style.rutinaMenu}>
              <p className={style.rutinaMenuTitulo}>¿Qué entrenás hoy?</p>
              {rutinas.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={style.rutinaMenuItem}
                  onClick={() => {
                    usarRutina(r);
                    setEligiendoRutina(false);
                  }}
                >
                  <strong>{r.nombre}</strong>
                  <span>
                    {r.dia ? `${r.dia} · ` : ""}
                    {(r.ejercicios || []).length} ej.
                  </span>
                </button>
              ))}
              <button
                type="button"
                className={style.rutinaMenuItem}
                onClick={() => {
                  setEligiendoRutina(false);
                  setAgregando(true);
                }}
              >
                <strong>Empezar vacío</strong>
                <span>elegís los ejercicios uno a uno</span>
              </button>
              {rutinas.length === 0 ? (
                <p className={style.hint}>Tip: en "Mis rutinas" podés armar tu rutina para cargarla de un toque.</p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {dia.map((ej) => (
        <Ejercicio key={ej.id} ej={ej} onSets={(sets) => editarSets(ej.id, sets)} onBorrar={() => borrarEjercicio(ej.id)} />
      ))}

      {agregando ? (
        <div className={style.addBox}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscá un ejercicio…" className={style.addInput} />
          <div className={style.sugList}>
            {sugerencias.map((s, i) => (
              <button
                key={i}
                type="button"
                className={style.sugRow}
                onClick={() => {
                  agregarEjercicio(s);
                  setQ("");
                  setAgregando(false);
                }}
              >
                <span className={style.sugNombre}>{s.nombre}</span>
                {s.grupo ? <span className={style.sugGrupo}>{s.grupo}</span> : null}
              </button>
            ))}
            {q.trim() && !sugerencias.some((s) => norm(s.nombre) === norm(q)) ? (
              <button
                type="button"
                className={style.sugRow}
                onClick={() => {
                  agregarEjercicio({ nombre: q.trim(), grupo: "" });
                  setQ("");
                  setAgregando(false);
                }}
              >
                <span className={style.sugNombre}>➕ Crear "{q.trim()}"</span>
              </button>
            ) : null}
          </div>
          <button type="button" className={style.addCancel} onClick={() => setAgregando(false)}>
            Cancelar
          </button>
        </div>
      ) : !sinEntreno ? (
        <div className={style.addActions}>
          <button type="button" className={style.addBtn} onClick={() => setAgregando(true)}>
            <FiPlus /> Agregar ejercicio
          </button>
        </div>
      ) : null}
    </>
  );
}

function Ejercicio({ ej, onSets, onBorrar }) {
  const setSet = (i, campo, val) => {
    const sets = ej.sets.map((s, j) => (j === i ? { ...s, [campo]: val } : s));
    onSets(sets);
  };
  const addSet = () => {
    const ult = ej.sets[ej.sets.length - 1] || { kg: 0, reps: 0 };
    onSets([...ej.sets, { kg: ult.kg, reps: ult.reps, hecha: false }]);
  };
  const delSet = (i) => onSets(ej.sets.filter((_, j) => j !== i));

  return (
    <section className={style.ejercicio}>
      <div className={style.ejHead}>
        <div>
          <strong className={style.ejNombre}>{ej.nombre}</strong>
          {ej.grupo ? <span className={style.ejGrupo}>{ej.grupo}</span> : null}
        </div>
        <button type="button" className={style.iconBtn} onClick={onBorrar} title="Quitar ejercicio">
          <FiTrash2 />
        </button>
      </div>
      <div className={style.setsHead}>
        <span>Serie</span>
        <span>Kg</span>
        <span>Reps</span>
        <span />
      </div>
      {ej.sets.map((s, i) => (
        <div key={i} className={`${style.setRow} ${s.hecha ? style.setRowOn : ""}`}>
          <span className={style.setNum}>{i + 1}</span>
          <input
            type="number"
            min="0"
            value={s.kg || ""}
            onChange={(e) => setSet(i, "kg", Number(e.target.value) || 0)}
            placeholder="0"
          />
          <input
            type="number"
            min="0"
            value={s.reps || ""}
            onChange={(e) => setSet(i, "reps", Number(e.target.value) || 0)}
            placeholder="0"
          />
          <div className={style.setActions}>
            <button
              type="button"
              className={s.hecha ? style.checkOn : style.checkOff}
              onClick={() => setSet(i, "hecha", !s.hecha)}
              title="Marcar como hecha"
            >
              <FiCheck />
            </button>
            <button type="button" className={style.iconBtnSm} onClick={() => delSet(i)} title="Quitar serie">
              <FiX />
            </button>
          </div>
        </div>
      ))}
      <button type="button" className={style.addSet} onClick={addSet}>
        <FiPlus /> Agregar serie
      </button>
    </section>
  );
}

/* ============================ Rutinas ============================ */
function Rutinas({ rutinas, guardarRutinas, buscarEjercicios }) {
  const [editando, setEditando] = useState(null); // rutina en edición (objeto) o null
  const nueva = () => setEditando({ id: uid(), nombre: "", dia: "", ejercicios: [] });

  const guardar = (rutina) => {
    if (!rutina.nombre.trim()) return;
    const existe = rutinas.some((r) => r.id === rutina.id);
    const lista = existe ? rutinas.map((r) => (r.id === rutina.id ? rutina : r)) : [...rutinas, rutina];
    guardarRutinas(lista);
    setEditando(null);
  };
  const borrar = (id) => guardarRutinas(rutinas.filter((r) => r.id !== id));

  if (editando) {
    return <RutinaEditor rutina={editando} onGuardar={guardar} onCancelar={() => setEditando(null)} buscarEjercicios={buscarEjercicios} />;
  }

  return (
    <>
      <button type="button" className={style.addBtn} onClick={nueva}>
        <FiPlus /> Nueva rutina
      </button>
      {rutinas.length === 0 ? <p className={style.vacio}>Todavía no tenés rutinas. Creá una para reutilizarla al entrenar.</p> : null}
      {rutinas.map((r) => (
        <section key={r.id} className={style.rutinaCard}>
          <div className={style.ejHead}>
            <div>
              <strong className={style.ejNombre}>{r.nombre}</strong>
              {r.dia ? <span className={style.ejGrupo}>{r.dia}</span> : null}
            </div>
            <div className={style.rutinaCardActions}>
              <button type="button" className={style.iconBtn} onClick={() => setEditando(r)} title="Editar">
                <FiEdit2 />
              </button>
              <button type="button" className={style.iconBtn} onClick={() => borrar(r.id)} title="Borrar">
                <FiTrash2 />
              </button>
            </div>
          </div>
          <ul className={style.rutinaEjList}>
            {(r.ejercicios || []).map((e, i) => (
              <li key={i}>
                <span>{e.nombre}</span>
                <span className={style.rutinaEjMeta}>
                  {e.series || 0} × {e.reps || 0}
                  {e.kg ? ` · ${e.kg} kg` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function RutinaEditor({ rutina, onGuardar, onCancelar, buscarEjercicios }) {
  const [nombre, setNombre] = useState(rutina.nombre);
  const [diaSemana, setDiaSemana] = useState(rutina.dia || "");
  const [ejercicios, setEjercicios] = useState(rutina.ejercicios || []);
  const [q, setQ] = useState("");
  const sugerencias = q.length >= 1 ? buscarEjercicios(q) : [];

  const addEj = (ej) => {
    setEjercicios([...ejercicios, { nombre: ej.nombre, grupo: ej.grupo || "", series: 3, reps: 10, kg: 0 }]);
    setQ("");
  };
  const setEj = (i, campo, val) => setEjercicios(ejercicios.map((e, j) => (j === i ? { ...e, [campo]: val } : e)));
  const delEj = (i) => setEjercicios(ejercicios.filter((_, j) => j !== i));

  return (
    <section className={style.rutinaCard}>
      <input className={style.addInput} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la rutina (ej: Push)" />
      <select className={style.diaSelect} value={diaSemana} onChange={(e) => setDiaSemana(e.target.value)}>
        <option value="">Sin día fijo</option>
        {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      {ejercicios.length ? (
        <div className={style.rutinaEjEditHead}>
          <span />
          <span>Series</span>
          <span />
          <span>Reps</span>
          <span>Kg</span>
          <span />
        </div>
      ) : null}
      {ejercicios.map((e, i) => (
        <div key={i} className={style.rutinaEjEdit}>
          <span className={style.rutinaEjNombre}>{e.nombre}</span>
          <input type="number" min="1" value={e.series || ""} onChange={(ev) => setEj(i, "series", Number(ev.target.value) || 0)} title="Series" />
          <span>×</span>
          <input type="number" min="1" value={e.reps || ""} onChange={(ev) => setEj(i, "reps", Number(ev.target.value) || 0)} title="Reps" />
          <input type="number" min="0" value={e.kg || ""} onChange={(ev) => setEj(i, "kg", Number(ev.target.value) || 0)} title="Peso (kg)" placeholder="kg" />
          <button type="button" className={style.iconBtnSm} onClick={() => delEj(i)}>
            <FiX />
          </button>
        </div>
      ))}

      <div className={style.addBox}>
        <input className={style.addInput} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Agregar ejercicio…" />
        {q.trim() || sugerencias.length ? (
          <div className={style.sugList}>
            {sugerencias.map((s, i) => (
              <button key={i} type="button" className={style.sugRow} onClick={() => addEj(s)}>
                <span className={style.sugNombre}>{s.nombre}</span>
                {s.grupo ? <span className={style.sugGrupo}>{s.grupo}</span> : null}
              </button>
            ))}
            {q.trim() && !sugerencias.some((s) => norm(s.nombre) === norm(q)) ? (
              <button type="button" className={style.sugRow} onClick={() => addEj({ nombre: q.trim(), grupo: "" })}>
                <span className={style.sugNombre}>➕ Crear "{q.trim()}"</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={style.editorActions}>
        <button type="button" className={style.addCancel} onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className={style.guardarBtn} onClick={() => onGuardar({ id: rutina.id, nombre, dia: diaSemana, ejercicios })}>
          Guardar rutina
        </button>
      </div>
    </section>
  );
}

/* ============================ Progreso ============================ */
function Progreso({ entrenos }) {
  // Ejercicios que aparecen en el historial.
  const ejercicios = useMemo(() => {
    const map = new Map();
    Object.values(entrenos || {}).forEach((arr) => (arr || []).forEach((e) => map.set(norm(e.nombre), e.nombre)));
    return [...map.values()].sort();
  }, [entrenos]);
  const [sel, setSel] = useState("");
  const elegido = sel || ejercicios[0] || "";

  // Series por sesión para el ejercicio elegido.
  const porSesion = useMemo(() => {
    if (!elegido) return [];
    const dias = Object.keys(entrenos || {}).sort();
    const out = [];
    dias.forEach((k) => {
      const ej = (entrenos[k] || []).find((e) => norm(e.nombre) === norm(elegido));
      if (!ej) return;
      const maxKg = Math.max(0, ...ej.sets.map((s) => Number(s.kg) || 0));
      const reps = ej.sets.reduce((a, s) => a + (Number(s.reps) || 0), 0);
      if (maxKg > 0 || reps > 0) out.push({ fecha: k, maxKg, reps });
    });
    return out.slice(-20);
  }, [entrenos, elegido]);

  const serieKg = porSesion.filter((p) => p.maxKg > 0).map((p) => ({ label: fmtCorta(p.fecha), value: p.maxKg }));
  const serieReps = porSesion.filter((p) => p.reps > 0).map((p) => ({ label: fmtCorta(p.fecha), value: p.reps }));

  const ultimo = serieKg.length ? serieKg[serieKg.length - 1].value : 0;
  const anterior = serieKg.length >= 2 ? serieKg[serieKg.length - 2].value : null;
  const delta = anterior != null ? ultimo - anterior : null;
  const record = serieKg.length ? Math.max(...serieKg.map((p) => p.value)) : 0;

  if (!ejercicios.length) {
    return <p className={style.vacio}>Cuando registres entrenamientos, acá vas a ver tu progreso por ejercicio.</p>;
  }

  return (
    <>
      <select className={style.diaSelect} value={elegido} onChange={(e) => setSel(e.target.value)}>
        {ejercicios.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>

      <section className={style.progresoCard}>
        <div className={style.progresoTop}>
          <div>
            <p className={style.progresoValor}>
              {ultimo} kg
              {delta != null && delta !== 0 ? (
                <span className={delta > 0 ? style.deltaUp : style.deltaDown}>
                  {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} kg
                </span>
              ) : null}
            </p>
            <span className={style.progresoLabel}>
              peso máximo de tu última sesión
              {delta != null ? " · vs la anterior" : ""}
            </span>
          </div>
          <div className={style.progresoDer}>
            <span className={style.progresoSesiones}>{porSesion.length} sesiones</span>
            {record > 0 ? <span className={style.progresoRecord}>🏆 récord: {record} kg</span> : null}
          </div>
        </div>

        {serieKg.length >= 2 ? (
          <ChartLinea titulo="Peso máximo por sesión" points={serieKg} unidad="kg" color="var(--color-verde, #5dc72d)" />
        ) : (
          <p className={style.hint}>Registrá al menos 2 sesiones de este ejercicio para ver la curva.</p>
        )}
      </section>

      {serieReps.length >= 2 ? (
        <section className={style.progresoCard}>
          <ChartLinea titulo="Repeticiones totales por sesión" points={serieReps} unidad="reps" color="#3aa0e0" />
        </section>
      ) : null}
    </>
  );
}

// Fecha corta para etiquetas del gráfico: "3/8".
function fmtCorta(key) {
  const d = new Date(`${key}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// Path SVG suavizado (curvas), igual que en Salud.
function smoothPath(pts) {
  if (pts.length < 2) return pts.length ? `M ${pts[0][0]} ${pts[0][1]}` : "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

// Gráfico de línea suavizado con tooltip (mismo estilo que Movilidad/Calorías).
function ChartLinea({ titulo, points, unidad, color }) {
  const [hover, setHover] = useState(null);
  const [pinned, setPinned] = useState(null);
  const W = 100;
  const H = 110;
  const padTop = 12;
  const padBottom = 8;
  const n = points.length;
  const max = Math.max(...points.map((p) => p.value), 1);
  const innerH = H - padTop - padBottom;
  const xy = points.map((p, i) => [n <= 1 ? W / 2 : (i / (n - 1)) * W, padTop + innerH - (p.value / max) * innerH]);
  const line = smoothPath(xy);
  const area = n >= 2 ? `${line} L ${xy[n - 1][0]} ${H} L ${xy[0][0]} ${H} Z` : "";
  const step = n > 8 ? Math.ceil(n / 5) : 1;

  const idxFrom = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const rel = Math.max(0, Math.min(1, cx / rect.width));
    return n <= 1 ? 0 : Math.round(rel * (n - 1));
  };
  const sel = hover != null ? hover : pinned != null ? pinned : n - 1;
  const h = sel != null && points[sel] ? { p: points[sel], x: xy[sel][0], y: xy[sel][1] } : null;

  return (
    <div>
      <p className={style.chartTitulo}>{titulo}</p>
      <div
        className={style.chartWrap}
        onMouseMove={(e) => setHover(idxFrom(e))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const i = idxFrom(e);
          setPinned((prev) => (prev === i ? null : i));
        }}
      >
        <svg className={style.chartSvg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
          {area ? <path d={area} fill={color} opacity="0.13" /> : null}
          <path d={line} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {h ? (
          <>
            <div className={style.chartGuide} style={{ left: `${h.x}%` }} />
            <div className={style.chartDot} style={{ left: `${h.x}%`, top: `${h.y}px`, background: color }} />
            <div className={style.chartTip} style={{ left: `${h.x}%`, borderColor: color }}>
              <strong>{h.p.value.toLocaleString("es-AR")}</strong> {unidad} · {h.p.label}
            </div>
          </>
        ) : null}
        <div className={style.chartLabels}>
          {points.map((p, i) => (
            <span key={i}>{i % step === 0 || i === n - 1 ? p.label : ""}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
