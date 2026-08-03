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
      .then(({ data: d }) => setData({ ejercicios: d?.ejercicios || [], rutinas: d?.rutinas || [], entrenos: d?.entrenos || {} }))
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
      sets: Array.from({ length: Math.max(1, e.series || 1) }, () => ({ kg: 0, reps: e.reps || 0, hecha: false })),
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
            { k: "registro", label: "Entrenar" },
            { k: "rutinas", label: "Mis rutinas" },
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
        />
      ) : tab === "rutinas" ? (
        <Rutinas rutinas={data.rutinas} guardarRutinas={guardarRutinas} buscarEjercicios={buscarEjercicios} />
      ) : (
        <Progreso entrenos={data.entrenos} />
      )}
    </div>
  );
}

/* ============================ Registro ============================ */
function Registro({ dia, fecha, setFecha, buscarEjercicios, agregarEjercicio, borrarEjercicio, editarSets, rutinas, usarRutina }) {
  const [agregando, setAgregando] = useState(false);
  const [q, setQ] = useState("");
  const [eligiendoRutina, setEligiendoRutina] = useState(false);
  const sugerencias = agregando ? buscarEjercicios(q) : [];

  const totalSeries = dia.reduce((a, e) => a + e.sets.filter((s) => s.hecha).length, 0);
  const sinEntreno = dia.length === 0;

  return (
    <>
      <div className={style.dayBar}>
        <div className={style.dateNav}>
          <button type="button" onClick={() => setFecha(addDays(fecha, -1))} aria-label="Día anterior">
            <FiChevronLeft />
          </button>
          <span>{fechaLabel(fecha)}</span>
          <button type="button" disabled={fecha >= hoyKey()} onClick={() => fecha < hoyKey() && setFecha(addDays(fecha, 1))} aria-label="Día siguiente">
            <FiChevronRight />
          </button>
        </div>
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
    setEjercicios([...ejercicios, { nombre: ej.nombre, grupo: ej.grupo || "", series: 3, reps: 10 }]);
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

      {ejercicios.map((e, i) => (
        <div key={i} className={style.rutinaEjEdit}>
          <span className={style.rutinaEjNombre}>{e.nombre}</span>
          <input type="number" min="1" value={e.series || ""} onChange={(ev) => setEj(i, "series", Number(ev.target.value) || 0)} title="Series" />
          <span>×</span>
          <input type="number" min="1" value={e.reps || ""} onChange={(ev) => setEj(i, "reps", Number(ev.target.value) || 0)} title="Reps" />
          <button type="button" className={style.iconBtnSm} onClick={() => delEj(i)}>
            <FiX />
          </button>
        </div>
      ))}

      <div className={style.addBox}>
        <input className={style.addInput} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Agregar ejercicio…" />
        {sugerencias.length ? (
          <div className={style.sugList}>
            {sugerencias.map((s, i) => (
              <button key={i} type="button" className={style.sugRow} onClick={() => addEj(s)}>
                <span className={style.sugNombre}>{s.nombre}</span>
                {s.grupo ? <span className={style.sugGrupo}>{s.grupo}</span> : null}
              </button>
            ))}
            {q.trim() && !sugerencias.some((s) => norm(s.nombre) === norm(q)) ? (
              <button type="button" className={style.sugRow} onClick={() => addEj({ nombre: q.trim(), grupo: "" })}>
                ➕ Crear "{q.trim()}"
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

  // Peso máximo levantado por sesión (día) para el ejercicio elegido.
  const serie = useMemo(() => {
    if (!elegido) return [];
    const dias = Object.keys(entrenos || {}).sort();
    const out = [];
    dias.forEach((k) => {
      const ej = (entrenos[k] || []).find((e) => norm(e.nombre) === norm(elegido));
      if (!ej) return;
      const best = Math.max(0, ...ej.sets.map((s) => Number(s.kg) || 0));
      if (best > 0) out.push({ fecha: k, valor: best });
    });
    return out.slice(-20);
  }, [entrenos, elegido]);

  const max = Math.max(...serie.map((p) => p.valor), 1);
  const ultimo = serie.length ? serie[serie.length - 1].valor : 0;
  const anterior = serie.length >= 2 ? serie[serie.length - 2].valor : null;
  const delta = anterior != null ? ultimo - anterior : null;
  const record = serie.length ? Math.max(...serie.map((p) => p.valor)) : 0;

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
            <span className={style.progresoSesiones}>{serie.length} sesiones</span>
            {record > 0 ? <span className={style.progresoRecord}>🏆 récord: {record} kg</span> : null}
          </div>
        </div>

        {serie.length >= 2 ? (
          <svg className={style.progresoSvg} viewBox="0 0 100 60" preserveAspectRatio="none">
            <polyline
              points={serie.map((p, i) => `${(i / (serie.length - 1)) * 100},${54 - (p.valor / max) * 48}`).join(" ")}
              fill="none"
              stroke="var(--color-verde, #5dc72d)"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <p className={style.hint}>Registrá al menos 2 sesiones de este ejercicio para ver la curva.</p>
        )}
      </section>
    </>
  );
}
