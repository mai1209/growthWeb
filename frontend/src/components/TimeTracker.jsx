import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiPlay, FiSquare, FiTrash2, FiPlus, FiClock } from "react-icons/fi";
import { timeEntryService } from "../api";
import style from "../style/TimeTracker.module.css";

const RUNNING_KEY = "gw-timetracker-running";

const pad = (n) => String(n).padStart(2, "0");

// Segundos -> "1h 23m" o "12m 05s"
const fmtDuration = (secs) => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(sec)}s`;
  return `${sec}s`;
};

// Cronómetro grande "HH:MM:SS"
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
  const day = (x.getDay() + 6) % 7; // lunes = 0
  x.setDate(x.getDate() - day);
  return x;
};

const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

// Valor para <input type="datetime-local"> a partir de una fecha
const toLocalInput = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

export default function TimeTracker() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [descripcion, setDescripcion] = useState("");
  const [running, setRunning] = useState(null); // { startedAt: ISO, descripcion }
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ descripcion: "", inicio: "", fin: "" });

  const tickRef = useRef(null);

  const fetchEntries = useCallback(async () => {
    setError("");
    try {
      const res = await timeEntryService.getAll();
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError("No se pudieron cargar los registros.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    // Restaurar cronómetro en curso (sobrevive recargas)
    try {
      const raw = localStorage.getItem(RUNNING_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.startedAt) {
          setRunning(parsed);
          setDescripcion(parsed.descripcion || "");
        }
      }
    } catch {
      /* nada */
    }
  }, [fetchEntries]);

  // Tick cada segundo mientras corre
  useEffect(() => {
    if (!running) {
      if (tickRef.current) clearInterval(tickRef.current);
      return undefined;
    }
    setNow(Date.now());
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  const elapsed = running
    ? Math.floor((now - new Date(running.startedAt).getTime()) / 1000)
    : 0;

  const handleStart = () => {
    const payload = { startedAt: new Date().toISOString(), descripcion: descripcion.trim() };
    setRunning(payload);
    try {
      localStorage.setItem(RUNNING_KEY, JSON.stringify(payload));
    } catch {
      /* nada */
    }
  };

  const handleStop = async () => {
    if (!running || saving) return;
    setSaving(true);
    try {
      await timeEntryService.create({
        descripcion: running.descripcion || descripcion.trim(),
        inicio: running.startedAt,
        fin: new Date().toISOString(),
      });
      setRunning(null);
      setDescripcion("");
      localStorage.removeItem(RUNNING_KEY);
      await fetchEntries();
    } catch {
      setError("No se pudo guardar la sesión.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await timeEntryService.delete(id);
      setEntries((prev) => prev.filter((e) => e._id !== id));
    } catch {
      setError("No se pudo eliminar el registro.");
    }
  };

  const openManual = () => {
    const nowD = new Date();
    const before = new Date(nowD.getTime() - 30 * 60 * 1000);
    setManual({
      descripcion: "",
      inicio: toLocalInput(before),
      fin: toLocalInput(nowD),
    });
    setManualOpen(true);
  };

  const submitManual = async (event) => {
    event.preventDefault();
    if (!manual.inicio || !manual.fin) return;
    const inicio = new Date(manual.inicio);
    const fin = new Date(manual.fin);
    if (fin.getTime() < inicio.getTime()) {
      setError("El fin no puede ser anterior al inicio.");
      return;
    }
    try {
      await timeEntryService.create({
        descripcion: manual.descripcion.trim(),
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
      });
      setManualOpen(false);
      await fetchEntries();
    } catch {
      setError("No se pudo guardar el registro.");
    }
  };

  // Totales
  const { todayEntries, todayTotal, weekTotal } = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today);
    let dToday = 0;
    let dWeek = 0;
    const tEntries = [];
    entries.forEach((e) => {
      const start = new Date(e.inicio);
      const dur = Number(e.duracion) || 0;
      if (start >= weekStart) dWeek += dur;
      if (isSameDay(start, today)) {
        dToday += dur;
        tEntries.push(e);
      }
    });
    return { todayEntries: tEntries, todayTotal: dToday, weekTotal: dWeek };
  }, [entries]);

  return (
    <div className={style.wrap}>
      {/* Cronómetro */}
      <section className={style.timerCard}>
        <input
          className={style.descInput}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="¿En qué estás trabajando?"
          maxLength={160}
          disabled={Boolean(running)}
        />

        <div className={style.clock}>{fmtClock(elapsed)}</div>

        {running ? (
          <button
            type="button"
            className={`${style.bigBtn} ${style.stopBtn}`}
            onClick={handleStop}
            disabled={saving}
          >
            <FiSquare /> {saving ? "Guardando…" : "Detener y guardar"}
          </button>
        ) : (
          <button type="button" className={`${style.bigBtn} ${style.startBtn}`} onClick={handleStart}>
            <FiPlay /> Iniciar
          </button>
        )}

        <div className={style.totalsRow}>
          <div className={style.totalCard}>
            <span>Hoy</span>
            <strong>{fmtDuration(todayTotal + (running ? elapsed : 0))}</strong>
          </div>
          <div className={style.totalCard}>
            <span>Esta semana</span>
            <strong>{fmtDuration(weekTotal + (running ? elapsed : 0))}</strong>
          </div>
        </div>
      </section>

      {/* Entradas de hoy */}
      <section className={style.listCard}>
        <div className={style.listHead}>
          <h2>
            <FiClock /> Sesiones de hoy
          </h2>
          <button type="button" className={style.manualBtn} onClick={openManual}>
            <FiPlus /> Cargar manual
          </button>
        </div>

        {error ? <p className={style.error}>{error}</p> : null}

        {loading ? (
          <p className={style.empty}>Cargando…</p>
        ) : todayEntries.length === 0 ? (
          <p className={style.empty}>
            Todavía no registraste horas hoy. Tocá <strong>Iniciar</strong> o cargá una sesión manual.
          </p>
        ) : (
          <ul className={style.entryList}>
            {todayEntries.map((e) => {
              const start = new Date(e.inicio);
              const end = new Date(e.fin);
              return (
                <li key={e._id} className={style.entryItem}>
                  <div className={style.entryMain}>
                    <strong>{e.descripcion || "Sin descripción"}</strong>
                    <span className={style.entryTime}>
                      {pad(start.getHours())}:{pad(start.getMinutes())} – {pad(end.getHours())}:
                      {pad(end.getMinutes())}
                    </span>
                  </div>
                  <span className={style.entryDur}>{fmtDuration(e.duracion)}</span>
                  <button
                    type="button"
                    className={style.deleteBtn}
                    onClick={() => handleDelete(e._id)}
                    aria-label="Eliminar"
                    title="Eliminar"
                  >
                    <FiTrash2 />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Modal carga manual */}
      {manualOpen ? (
        <div className={style.overlay} onClick={() => setManualOpen(false)} role="presentation">
          <form
            className={style.modal}
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitManual}
          >
            <h3>Cargar sesión manual</h3>
            <label className={style.field}>
              <span>¿En qué trabajaste?</span>
              <input
                value={manual.descripcion}
                onChange={(e) => setManual((p) => ({ ...p, descripcion: e.target.value }))}
                placeholder="Ej: Diseño landing"
                maxLength={160}
              />
            </label>
            <label className={style.field}>
              <span>Inicio</span>
              <input
                type="datetime-local"
                value={manual.inicio}
                onChange={(e) => setManual((p) => ({ ...p, inicio: e.target.value }))}
                required
              />
            </label>
            <label className={style.field}>
              <span>Fin</span>
              <input
                type="datetime-local"
                value={manual.fin}
                onChange={(e) => setManual((p) => ({ ...p, fin: e.target.value }))}
                required
              />
            </label>
            <div className={style.modalActions}>
              <button type="button" className={style.ghostBtn} onClick={() => setManualOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className={style.saveBtn}>
                Guardar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
