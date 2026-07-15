import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiPlay,
  FiPause,
  FiSquare,
  FiTrash2,
  FiPlus,
  FiChevronLeft,
  FiFolder,
  FiClock,
} from "react-icons/fi";
import { timeEntryService, projectService } from "../api";
import style from "../style/TimeTracker.module.css";

const RUNNING_KEY = "gw-timetracker-running";
const NO_PROJECT = "__none__";

const pad = (n) => String(n).padStart(2, "0");

const fmtDuration = (secs) => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(s % 60)}s`;
  return `${s % 60}s`;
};

const fmtClock = (secs) => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${pad(h)}:${pad(m)}:${pad(s % 60)}`;
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const startOfWeek = (d) => {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

const activeSecs = (r, nowMs) =>
  r ? r.accumulated + (r.segmentStart ? Math.floor((nowMs - new Date(r.segmentStart).getTime()) / 1000) : 0) : 0;

export default function TimeTracker() {
  const [projects, setProjects] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [openProject, setOpenProject] = useState(undefined); // undefined = carpetas; obj|null(none)
  const [newProjectName, setNewProjectName] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [running, setRunning] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [menuFor, setMenuFor] = useState(null); // id de la entrada con menú abierto
  const tickRef = useRef(null);

  const fetchAll = useCallback(async () => {
    setError("");
    try {
      const [p, e] = await Promise.all([projectService.getAll(), timeEntryService.getAll()]);
      setProjects(Array.isArray(p.data) ? p.data : []);
      setEntries(Array.isArray(e.data) ? e.data : []);
    } catch {
      setError("No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    try {
      const raw = localStorage.getItem(RUNNING_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.firstStart) {
          setRunning(parsed);
          setDescripcion(parsed.descripcion || "");
        }
      }
    } catch {
      /* nada */
    }
  }, [fetchAll]);

  useEffect(() => {
    if (!running || !running.segmentStart) {
      if (tickRef.current) clearInterval(tickRef.current);
      return undefined;
    }
    setNow(Date.now());
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  const persistRunning = (r) => {
    setRunning(r);
    try {
      if (r) localStorage.setItem(RUNNING_KEY, JSON.stringify(r));
      else localStorage.removeItem(RUNNING_KEY);
    } catch {
      /* nada */
    }
  };

  const currentProjectId = openProject === null ? null : openProject?._id;

  const handleStart = () => {
    persistRunning({
      proyecto: currentProjectId ?? null,
      descripcion: descripcion.trim(),
      firstStart: new Date().toISOString(),
      accumulated: 0,
      segmentStart: new Date().toISOString(),
    });
  };

  const handlePause = () => {
    if (!running?.segmentStart) return;
    const acc = running.accumulated + Math.floor((Date.now() - new Date(running.segmentStart).getTime()) / 1000);
    persistRunning({ ...running, accumulated: acc, segmentStart: null });
  };

  const handleResume = () => {
    if (!running || running.segmentStart) return;
    persistRunning({ ...running, segmentStart: new Date().toISOString() });
  };

  const handleFinish = async () => {
    if (!running || saving) return;
    setSaving(true);
    const total = activeSecs(running, Date.now());
    try {
      await timeEntryService.create({
        proyecto: running.proyecto || undefined,
        descripcion: running.descripcion || descripcion.trim(),
        inicio: running.firstStart,
        fin: new Date().toISOString(),
        duracion: total,
      });
      persistRunning(null);
      setDescripcion("");
      await fetchAll();
    } catch {
      setError("No se pudo guardar la sesión.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();
    const nombre = newProjectName.trim();
    if (!nombre) return;
    try {
      const res = await projectService.create({ nombre });
      setProjects((prev) => [res.data, ...prev]);
      setNewProjectName("");
    } catch {
      setError("No se pudo crear el proyecto.");
    }
  };

  const handleDeleteEntry = async (id) => {
    setMenuFor(null);
    try {
      await timeEntryService.delete(id);
      setEntries((prev) => prev.filter((e) => e._id !== id));
    } catch {
      setError("No se pudo eliminar la sesión.");
    }
  };

  const handleDeleteProject = async (project, event) => {
    event.stopPropagation();
    if (!window.confirm(`¿Borrar el proyecto "${project.nombre}"? Las sesiones quedan como "Sin proyecto".`)) {
      return;
    }
    try {
      await projectService.delete(project._id);
      setProjects((prev) => prev.filter((p) => p._id !== project._id));
      setEntries((prev) =>
        prev.map((e) => (e.proyecto === project._id ? { ...e, proyecto: null } : e))
      );
    } catch {
      setError("No se pudo eliminar el proyecto.");
    }
  };

  // Cerrar el menú de 3 puntitos al hacer clic en cualquier parte
  useEffect(() => {
    if (!menuFor) return undefined;
    const close = () => setMenuFor(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuFor]);

  // Totales por proyecto
  const totals = useMemo(() => {
    const map = new Map();
    const weekStart = startOfWeek(new Date());
    entries.forEach((e) => {
      const key = e.proyecto || NO_PROJECT;
      const cur = map.get(key) || { total: 0, week: 0, count: 0 };
      cur.total += Number(e.duracion) || 0;
      cur.count += 1;
      if (new Date(e.inicio) >= weekStart) cur.week += Number(e.duracion) || 0;
      map.set(key, cur);
    });
    return map;
  }, [entries]);

  const runningProject = running
    ? running.proyecto
      ? projects.find((p) => p._id === running.proyecto)
      : { nombre: "Sin proyecto" }
    : null;

  const elapsed = activeSecs(running, now);

  // ---------- Vista carpetas ----------
  if (openProject === undefined) {
    const noneTotals = totals.get(NO_PROJECT);
    return (
      <div className={style.foldersWrap}>
        <form className={style.createRow} onSubmit={handleCreateProject}>
          <input
            className={style.createInput}
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Crear trabajo o proyecto…"
            maxLength={80}
          />
          <button type="submit" className={style.createBtn} aria-label="Crear proyecto">
            <FiPlus />
          </button>
        </form>

        {running ? (
          <button
            type="button"
            className={style.runningBanner}
            onClick={() => setOpenProject(running.proyecto ? runningProject : null)}
          >
            <span className={style.runningDot} />
            Sesión {running.segmentStart ? "en curso" : "en pausa"} en{" "}
            <strong>{runningProject?.nombre || "Sin proyecto"}</strong> · {fmtClock(elapsed)}
          </button>
        ) : null}

        {error ? <p className={style.error}>{error}</p> : null}

        {loading ? (
          <p className={style.empty}>Cargando…</p>
        ) : projects.length === 0 && !noneTotals ? (
          <p className={style.empty}>
            Todavía no tenés proyectos. Creá uno arriba para empezar a registrar tus horas.
          </p>
        ) : (
          <div className={style.folderGrid}>
            {projects.map((p) => {
              const t = totals.get(p._id) || { total: 0, week: 0, count: 0 };
              return (
                <div
                  key={p._id}
                  className={style.folderCard}
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenProject(p)}
                  onKeyDown={(e) => e.key === "Enter" && setOpenProject(p)}
                >
                  <div className={style.folderTop}>
                    <span className={style.folderIcon} style={{ color: p.color || "#5dc72d" }}>
                      <FiFolder />
                    </span>
                    <button
                      type="button"
                      className={style.folderDelete}
                      onClick={(e) => handleDeleteProject(p, e)}
                      aria-label="Eliminar proyecto"
                      title="Eliminar proyecto"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                  <span className={style.folderName}>{p.nombre}</span>
                  <span className={style.folderTotal}>{fmtDuration(t.total)}</span>
                  <span className={style.folderMeta}>
                    {t.count} {t.count === 1 ? "sesión" : "sesiones"} · esta semana {fmtDuration(t.week)}
                  </span>
                </div>
              );
            })}

            {noneTotals ? (
              <div
                className={style.folderCard}
                role="button"
                tabIndex={0}
                onClick={() => setOpenProject(null)}
                onKeyDown={(e) => e.key === "Enter" && setOpenProject(null)}
              >
                <div className={style.folderTop}>
                  <span className={style.folderIcon} style={{ color: "#8a94a6" }}>
                    <FiFolder />
                  </span>
                </div>
                <span className={style.folderName}>Sin proyecto</span>
                <span className={style.folderTotal}>{fmtDuration(noneTotals.total)}</span>
                <span className={style.folderMeta}>
                  {noneTotals.count} {noneTotals.count === 1 ? "sesión" : "sesiones"}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  // ---------- Vista detalle de proyecto ----------
  const projName = openProject === null ? "Sin proyecto" : openProject.nombre;
  const projEntries = entries
    .filter((e) => (e.proyecto || null) === currentProjectId)
    .sort((a, b) => new Date(b.inicio) - new Date(a.inicio));
  const projTotals = totals.get(currentProjectId || NO_PROJECT) || { total: 0, week: 0 };
  const isRunningHere = running && (running.proyecto || null) === currentProjectId;
  const runningElsewhere = running && !isRunningHere;

  return (
    <div className={style.detailWrap}>
      <div className={style.detailHead}>
        <button type="button" className={style.backBtn} onClick={() => setOpenProject(undefined)}>
          <FiChevronLeft /> Proyectos
        </button>
        <h2 className={style.detailTitle}>{projName}</h2>
      </div>

      {/* Cronómetro */}
      <section className={style.timerCard}>
        <input
          className={style.descInput}
          value={isRunningHere ? running.descripcion : descripcion}
          onChange={(e) =>
            isRunningHere
              ? persistRunning({ ...running, descripcion: e.target.value })
              : setDescripcion(e.target.value)
          }
          placeholder="¿En qué estás trabajando?"
          maxLength={160}
        />

        <div className={style.clock}>{fmtClock(isRunningHere ? elapsed : 0)}</div>

        {runningElsewhere ? (
          <p className={style.warnNote}>
            Ya tenés una sesión en curso en <strong>{runningProject?.nombre}</strong>. Finalizala
            antes de arrancar otra.
          </p>
        ) : !running ? (
          <button type="button" className={`${style.bigBtn} ${style.startBtn}`} onClick={handleStart}>
            <FiPlay /> Iniciar
          </button>
        ) : (
          <div className={style.timerBtns}>
            {running.segmentStart ? (
              <button type="button" className={`${style.midBtn} ${style.pauseBtn}`} onClick={handlePause}>
                <FiPause /> Pausa
              </button>
            ) : (
              <button type="button" className={`${style.midBtn} ${style.resumeBtn}`} onClick={handleResume}>
                <FiPlay /> Reanudar
              </button>
            )}
            <button
              type="button"
              className={`${style.midBtn} ${style.stopBtn}`}
              onClick={handleFinish}
              disabled={saving}
            >
              <FiSquare /> {saving ? "Guardando…" : "Finalizar"}
            </button>
          </div>
        )}

        <div className={style.totalsRow}>
          <div className={style.totalCard}>
            <span>Total del proyecto</span>
            <strong>{fmtDuration(projTotals.total + (isRunningHere ? elapsed : 0))}</strong>
          </div>
          <div className={style.totalCard}>
            <span>Esta semana</span>
            <strong>{fmtDuration(projTotals.week + (isRunningHere ? elapsed : 0))}</strong>
          </div>
        </div>
      </section>

      {/* Sesiones del proyecto */}
      <section className={style.listCard}>
        <div className={style.listHead}>
          <h2>
            <FiClock /> Sesiones
          </h2>
        </div>

        {error ? <p className={style.error}>{error}</p> : null}

        {projEntries.length === 0 ? (
          <p className={style.empty}>Todavía no registraste sesiones en este proyecto.</p>
        ) : (
          <ul className={style.entryList}>
            {projEntries.map((e) => {
              const start = new Date(e.inicio);
              const end = new Date(e.fin);
              return (
                <li key={e._id} className={style.entryItem}>
                  <div className={style.entryMain}>
                    <strong>{e.descripcion || "Sin descripción"}</strong>
                    <span className={style.entryTime}>
                      {isSameDay(start, new Date())
                        ? "Hoy"
                        : start.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}{" "}
                      · {pad(start.getHours())}:{pad(start.getMinutes())} – {pad(end.getHours())}:
                      {pad(end.getMinutes())}
                    </span>
                  </div>
                  <span className={style.entryDur}>{fmtDuration(e.duracion)}</span>
                  <div className={style.menuWrap}>
                    <button
                      type="button"
                      className={style.menuBtn}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setMenuFor(menuFor === e._id ? null : e._id);
                      }}
                      aria-label="Opciones"
                    >
                      ⋯
                    </button>
                    {menuFor === e._id ? (
                      <div className={style.menu}>
                        <button type="button" onClick={() => handleDeleteEntry(e._id)}>
                          <FiTrash2 /> Eliminar
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
