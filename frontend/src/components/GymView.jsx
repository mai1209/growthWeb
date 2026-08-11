import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiChevronUp,
  FiPlus,
  FiTrash2,
  FiCheck,
  FiEdit2,
  FiX,
} from "react-icons/fi";
import { TbBarbell, TbTrophy } from "react-icons/tb";
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
  if (key === addDays(hoy, 1)) return "Mañana";
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
          <TbBarbell /> Gym
        </h1>
        <div className={style.tabs}>
          {[
            { k: "rutinas", label: "1 · Creá tu rutina" },
            { k: "registro", label: "2 · Asignar rutina" },
            { k: "progreso", label: "Progreso" },
          ].map((t) => (
            <button key={t.k} type="button" className={tab === t.k ? style.tabOn : style.tabOff} onClick={() => setTab(t.k)}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className={style.inner}>
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
            vaciarDia={() => guardarDia([])}
          />
        ) : tab === "rutinas" ? (
          <Rutinas rutinas={data.rutinas} guardarRutinas={guardarRutinas} buscarEjercicios={buscarEjercicios} />
        ) : (
          <Progreso entrenos={data.entrenos} />
        )}
      </div>
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
  // Colapsado (solo la semana) por defecto, como en la app: en el celular el mes
  // entero se veía gigante. "Ver mes" lo despliega.
  const [expandido, setExpandido] = useState(false);
  const hoy = hoyKey();

  // Mueve la fecha seleccionada N días (para navegar de a semanas colapsado).
  const shiftFecha = (delta) => {
    const d = new Date(`${fecha}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setFecha(dayKey(d));
  };

  const dowHeader = ["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
    <span key={`d${i}`} className={style.calDow}>
      {d}
    </span>
  ));

  const renderDia = (dateObj, i) => {
    const k = dayKey(dateObj);
    const tiene = (entrenos[k] || []).length > 0;
    const sel = k === fecha;
    const esHoy = k === hoy;
    return (
      <button
        key={i}
        type="button"
        className={`${style.calDia} ${sel ? style.calDiaSel : ""} ${esHoy && !sel ? style.calDiaHoy : ""}`}
        onClick={() => setFecha(k)}
      >
        {dateObj.getDate()}
        {tiene ? <span className={style.calDot} /> : null}
      </button>
    );
  };

  // ----- Colapsado: solo la semana de la fecha seleccionada -----
  if (!expandido) {
    const sel = new Date(`${fecha}T00:00:00`);
    const dow = (sel.getDay() + 6) % 7; // lunes = 0
    const lunes = new Date(sel);
    lunes.setDate(sel.getDate() - dow);
    const semana = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      return d;
    });
    return (
      <div className={style.cal}>
        <div className={style.calHead}>
          <button type="button" onClick={() => shiftFecha(-7)} aria-label="Semana anterior">
            <FiChevronLeft />
          </button>
          <span>{sel.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</span>
          <button type="button" onClick={() => shiftFecha(7)} aria-label="Semana siguiente">
            <FiChevronRight />
          </button>
        </div>
        <div className={style.calGrid}>
          {dowHeader}
          {semana.map((d, i) => renderDia(d, i))}
        </div>
        <button
          type="button"
          className={style.calToggle}
          onClick={() => {
            setMes(new Date(sel.getFullYear(), sel.getMonth(), 1));
            setExpandido(true);
          }}
        >
          <FiChevronDown />
          Ver mes
        </button>
      </div>
    );
  }

  // ----- Expandido: mes completo -----
  const y = mes.getFullYear();
  const m = mes.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();
  const primerDow = (new Date(y, m, 1).getDay() + 6) % 7; // lunes = 0
  const celdas = [...Array(primerDow).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];

  return (
    <div className={style.cal}>
      <div className={style.calHead}>
        <button type="button" onClick={() => setMes(new Date(y, m - 1, 1))} aria-label="Mes anterior">
          <FiChevronLeft />
        </button>
        <span>{mes.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</span>
        <button type="button" onClick={() => setMes(new Date(y, m + 1, 1))} aria-label="Mes siguiente">
          <FiChevronRight />
        </button>
      </div>
      <div className={style.calGrid}>
        {dowHeader}
        {celdas.map((d, i) =>
          d == null ? <span key={i} /> : renderDia(new Date(y, m, d), i)
        )}
      </div>
      <button type="button" className={style.calToggle} onClick={() => setExpandido(false)}>
        <FiChevronUp />
        Ver semana
      </button>
    </div>
  );
}

/* ============================ Registro ============================ */
function Registro({ dia, fecha, setFecha, buscarEjercicios, agregarEjercicio, borrarEjercicio, editarSets, rutinas, usarRutina, entrenos, vaciarDia }) {
  const [agregando, setAgregando] = useState(false);
  const [q, setQ] = useState("");
  const [eligiendoRutina, setEligiendoRutina] = useState(false);
  const sugerencias = agregando ? buscarEjercicios(q) : [];

  const totalSeries = dia.reduce((a, e) => a + e.sets.filter((s) => s.hecha).length, 0);
  const sinEntreno = dia.length === 0;
  const esFuturo = fecha > hoyKey();

  return (
    <div className={style.registroGrid}>
      <div className={style.dayBar}>
        <span className={style.diaSel}>{fechaLabel(fecha)}</span>
        {dia.length ? (
          <span className={style.dayBarDer}>
            <span className={style.resumenDia}>
              {esFuturo ? `${dia.length} ejercicios planificados` : `${totalSeries} series hechas`}
            </span>
            {/* Si asignaste la rutina equivocada: vaciás el día y elegís otra. */}
            <button
              type="button"
              className={style.vaciarBtn}
              onClick={() => {
                if (window.confirm("¿Vaciar este día? Se borran los ejercicios cargados y podés asignar otra rutina.")) {
                  vaciarDia();
                }
              }}
            >
              <FiTrash2 /> Vaciar día
            </button>
          </span>
        ) : null}
      </div>

      <div className={style.registroMain}>
      {/* Día vacío: hoy/pasado se entrena; futuro se planifica asignando una rutina. */}
      {sinEntreno && !agregando ? (
        <div className={style.entrenarHero}>
          {!eligiendoRutina ? (
            <>
              <p className={style.vacio}>
                {esFuturo ? "Este día todavía no tiene rutina asignada." : "Todavía no entrenaste este día."}
              </p>
              <button type="button" className={style.entrenarBtn} onClick={() => setEligiendoRutina(true)}>
                Asignar rutina a este día
              </button>
            </>
          ) : (
            <div className={style.rutinaMenu}>
              <p className={style.rutinaMenuTitulo}>{esFuturo ? "¿Qué vas a entrenar ese día?" : "¿Qué entrenás hoy?"}</p>
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
      </div>
      <aside className={style.registroCal}>
        <MiniCalendario fecha={fecha} setFecha={setFecha} entrenos={entrenos} />
      </aside>
    </div>
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

  const [periodo, setPeriodo] = useState("mes"); // semana | mes | anio
  const [metrica, setMetrica] = useState("kg"); // kg | reps | series

  // Datos del ejercicio elegido en un día: máximo kg, reps y series.
  const datosDia = (k) => {
    const ej = (entrenos[k] || []).find((e) => norm(e.nombre) === norm(elegido));
    if (!ej) return null;
    return {
      maxKg: Math.max(0, ...ej.sets.map((s) => Number(s.kg) || 0)),
      reps: ej.sets.reduce((a, s) => a + (Number(s.reps) || 0), 0),
      series: ej.sets.length,
    };
  };

  // Buckets por período, como la Tendencia de Movilidad (semana / mes / año).
  const buckets = useMemo(() => {
    const ahora = new Date();
    if (periodo === "anio") {
      const arr = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const dim = new Date(y, m + 1, 0).getDate();
        const dias = [];
        for (let dd = 1; dd <= dim; dd++) dias.push(`${y}-${pad(m + 1)}-${pad(dd)}`);
        arr.push({ label: MESES_G[m], dias });
      }
      return arr;
    }
    const n = periodo === "mes" ? 30 : 7;
    const arr = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(ahora);
      d.setDate(d.getDate() - i);
      arr.push({ label: periodo === "semana" ? DIAS_G[d.getDay()] : String(d.getDate()), dias: [dayKey(d)] });
    }
    return arr;
  }, [periodo]);

  // Puntos del gráfico: solo los días/meses con entreno (como el peso en Movilidad).
  const { points, sesiones } = useMemo(() => {
    let ses = 0;
    const pts = [];
    buckets.forEach((b) => {
      let vKg = 0;
      let vReps = 0;
      let vSeries = 0;
      let tiene = false;
      b.dias.forEach((k) => {
        const d = datosDia(k);
        if (!d) return;
        tiene = true;
        ses += 1;
        vKg = Math.max(vKg, d.maxKg);
        vReps += d.reps;
        vSeries += d.series;
      });
      if (!tiene) return;
      const value = metrica === "kg" ? vKg : metrica === "reps" ? vReps : vSeries;
      if (value > 0) pts.push({ label: b.label, value });
    });
    return { points: pts, sesiones: ses };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets, entrenos, elegido, metrica]);

  // Récord histórico y comparación de las últimas dos sesiones (siempre en kg).
  const sesionesKg = useMemo(() => {
    const out = [];
    Object.keys(entrenos || {})
      .sort()
      .forEach((k) => {
        const d = datosDia(k);
        if (d && d.maxKg > 0) out.push(d.maxKg);
      });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrenos, elegido]);
  const record = sesionesKg.length ? Math.max(...sesionesKg) : 0;
  const delta = sesionesKg.length >= 2 ? sesionesKg[sesionesKg.length - 1] - sesionesKg[sesionesKg.length - 2] : null;

  const grande = !points.length ? 0 : metrica === "kg" ? Math.max(...points.map((p) => p.value)) : points.reduce((a, p) => a + p.value, 0);
  // "Período" = el rango elegido con S/M/A, dicho con todas las letras.
  const RANGO = { semana: "los últimos 7 días", mes: "los últimos 30 días", anio: "los últimos 12 meses" };
  const M_INFO = {
    kg: { unidad: "kg", texto: `máximo de ${RANGO[periodo]}`, color: "var(--color-verde, #5dc72d)" },
    reps: { unidad: "reps", texto: `total de ${RANGO[periodo]}`, color: "#3aa0e0" },
    series: { unidad: "series", texto: `total de ${RANGO[periodo]}`, color: "#d6a92e" },
  };
  const info = M_INFO[metrica];

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
        <div className={style.progHead}>
          <div className={style.chips}>
            {[
              { k: "kg", label: "Peso máximo" },
              { k: "reps", label: "Repeticiones" },
              { k: "series", label: "Series" },
            ].map((m) => (
              <button key={m.k} type="button" className={metrica === m.k ? style.chipOn : style.chipOff} onClick={() => setMetrica(m.k)}>
                {m.label}
              </button>
            ))}
          </div>
          <div className={style.periodoSel}>
            {[
              { k: "semana", label: "S" },
              { k: "mes", label: "M" },
              { k: "anio", label: "A" },
            ].map((p) => (
              <button key={p.k} type="button" className={periodo === p.k ? style.periodoOn : style.periodoOff} onClick={() => setPeriodo(p.k)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className={style.progresoTop}>
          <div className={style.progresoHero}>
            <p className={style.progresoValor} style={{ color: info.color }}>
              {grande.toLocaleString("es-AR")} <span className={style.progresoUnidad}>{info.unidad}</span>
              {metrica === "kg" && delta != null && delta !== 0 ? (
                <span className={delta > 0 ? style.deltaUp : style.deltaDown}>
                  {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} kg
                </span>
              ) : null}
            </p>
            <span className={style.progresoLabel}>
              {info.texto}
              {metrica === "kg" && delta != null ? " · vs tu sesión anterior" : ""}
            </span>
          </div>
          <div className={style.statTiles}>
            <div className={style.statTile}>
              <strong>{sesiones}</strong>
              <span>{sesiones === 1 ? "sesión" : "sesiones"}</span>
            </div>
            {record > 0 ? (
              <div className={style.statTile}>
                <strong>
                  <TbTrophy className={style.trofeo} /> {record}
                  <small>kg</small>
                </strong>
                <span>récord</span>
              </div>
            ) : null}
          </div>
        </div>

        {points.length >= 1 ? (
          <>
            <ChartLinea points={points} unidad={info.unidad} color={info.color} />
            {points.length === 1 ? (
              <p className={style.hint}>Cada punto es una sesión: a medida que entrenes más veces, se va dibujando la curva.</p>
            ) : null}
          </>
        ) : (
          <p className={style.hint}>
            No entrenaste este ejercicio en {RANGO[periodo]}. Probá con M o A arriba a la derecha para ver más atrás.
          </p>
        )}
      </section>
    </>
  );
}

const DIAS_G = ["D", "L", "M", "M", "J", "V", "S"];
const MESES_G = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

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
  // 15% de aire arriba: una serie plana no queda pegada al techo del gráfico.
  const max = Math.max(...points.map((p) => p.value), 1) * 1.15;
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
      {titulo ? <p className={style.chartTitulo}>{titulo}</p> : null}
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
