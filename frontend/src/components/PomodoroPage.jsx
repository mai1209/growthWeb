import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiPause, FiPlay, FiRotateCcw, FiSkipForward } from "react-icons/fi";
import style from "../style/Pomodoro.module.css";

const MODES = [
  { key: "focus", label: "Enfoque", defaultMin: 25 },
  { key: "short", label: "Descanso", defaultMin: 5 },
  { key: "long", label: "Descanso largo", defaultMin: 15 },
];

const SETTINGS_KEY = "gm_pomodoro_settings";
const NOTES_KEY = "gm_pomodoro_notes";
const COUNT_KEY = "gm_pomodoro_count";

const todayKey = () => new Date().toISOString().slice(0, 10);

const loadJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const beep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
    osc.start();
    osc.stop(ctx.currentTime + 0.9);
  } catch {
    // sin audio disponible, no pasa nada
  }
};

const fmt = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export default function PomodoroPage() {
  const [durations, setDurations] = useState(() => {
    const saved = loadJSON(SETTINGS_KEY, null);
    return {
      focus: saved?.focus || 25,
      short: saved?.short || 5,
      long: saved?.long || 15,
    };
  });
  const [mode, setMode] = useState("focus");
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(durations.focus * 60);
  const [notes, setNotes] = useState(() => loadJSON(NOTES_KEY, []));
  const [noteText, setNoteText] = useState("");
  const [completed, setCompleted] = useState(() => {
    const saved = loadJSON(COUNT_KEY, null);
    return saved && saved.date === todayKey() ? saved.count : 0;
  });

  const targetRef = useRef(null);
  const totalSecs = durations[mode] * 60;

  // Persistencia
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(durations));
  }, [durations]);
  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes]);
  useEffect(() => {
    localStorage.setItem(COUNT_KEY, JSON.stringify({ date: todayKey(), count: completed }));
  }, [completed]);

  const handleComplete = useCallback(() => {
    beep();
    setRunning(false);
    targetRef.current = null;
    if (mode === "focus") {
      setCompleted((c) => c + 1);
      // cada 4 enfoques, descanso largo
      const next = (completed + 1) % 4 === 0 ? "long" : "short";
      setMode(next);
      setRemaining(durations[next] * 60);
    } else {
      setMode("focus");
      setRemaining(durations.focus * 60);
    }
  }, [mode, completed, durations]);

  // Tick por timestamp (preciso aunque el tab se ralentice)
  useEffect(() => {
    if (!running) return undefined;
    if (targetRef.current == null) {
      targetRef.current = Date.now() + remaining * 1000;
    }
    const id = setInterval(() => {
      const left = Math.round((targetRef.current - Date.now()) / 1000);
      if (left <= 0) {
        setRemaining(0);
        handleComplete();
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, handleComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchMode = (key) => {
    setRunning(false);
    targetRef.current = null;
    setMode(key);
    setRemaining(durations[key] * 60);
  };

  const toggleRun = () => {
    if (running) {
      // pausar: guardo lo que resta
      targetRef.current = null;
      setRunning(false);
    } else {
      targetRef.current = Date.now() + remaining * 1000;
      setRunning(true);
    }
  };

  const reset = () => {
    setRunning(false);
    targetRef.current = null;
    setRemaining(durations[mode] * 60);
  };

  const changeDuration = (key, delta) => {
    setDurations((d) => {
      const val = Math.min(90, Math.max(1, d[key] + delta));
      const next = { ...d, [key]: val };
      if (key === mode && !running) setRemaining(val * 60);
      return next;
    });
  };

  const addNote = (e) => {
    e.preventDefault();
    const text = noteText.trim();
    if (!text) return;
    setNotes((n) => [{ id: `${Date.now()}`, text, done: false }, ...n]);
    setNoteText("");
  };
  const toggleNote = (id) =>
    setNotes((n) => n.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  const deleteNote = (id) => setNotes((n) => n.filter((it) => it.id !== id));

  // Anillo de progreso
  const R = 140;
  const CIRC = 2 * Math.PI * R;
  const progress = totalSecs > 0 ? remaining / totalSecs : 0;
  const dashOffset = useMemo(() => CIRC * (1 - progress), [CIRC, progress]);
  const modeLabel = MODES.find((m) => m.key === mode)?.label || "";

  return (
    <div className={style.page}>
      <header className={style.header}>
        <h1>Pomodoro</h1>
        <p>Enfocate en bloques, descansá entre medio y anotá en qué estás trabajando.</p>
      </header>

      <div className={style.grid}>
        {/* Temporizador */}
        <section className={style.timerCard}>
          <div className={style.modeRow}>
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`${style.modeBtn} ${mode === m.key ? style.modeBtnActive : ""}`}
                onClick={() => switchMode(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className={style.ringWrap}>
            <svg className={style.ring} viewBox="0 0 300 300">
              <defs>
                <linearGradient id="pomoGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--color-verde)" />
                  <stop offset="100%" stopColor="#13aab6" />
                </linearGradient>
              </defs>
              <circle className={style.ringTrack} cx="150" cy="150" r={R} />
              <circle
                className={style.ringProgress}
                cx="150"
                cy="150"
                r={R}
                strokeDasharray={CIRC}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <span className={style.timeDisplay}>{fmt(remaining)}</span>
            <span className={style.timeLabel}>{modeLabel}</span>
          </div>

          <div className={style.controls}>
            <button type="button" className={style.primaryBtn} onClick={toggleRun}>
              {running ? <FiPause /> : <FiPlay />}
              {running ? "Pausar" : "Iniciar"}
            </button>
            <button
              type="button"
              className={style.secondaryBtn}
              onClick={reset}
              title="Reiniciar"
              aria-label="Reiniciar"
            >
              <FiRotateCcw size={20} />
            </button>
            <button
              type="button"
              className={style.secondaryBtn}
              onClick={handleComplete}
              title="Saltar"
              aria-label="Saltar"
            >
              <FiSkipForward size={20} />
            </button>
          </div>

          <p className={style.counter}>
            Pomodoros completados hoy: <strong>{completed}</strong>
          </p>

          <div className={style.settings}>
            {MODES.map((m) => (
              <div key={m.key} className={style.settingField}>
                <label>{m.label} (min)</label>
                <div className={style.stepper}>
                  <button type="button" onClick={() => changeDuration(m.key, -1)}>
                    −
                  </button>
                  <span>{durations[m.key]}</span>
                  <button type="button" onClick={() => changeDuration(m.key, 1)}>
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Notas */}
        <section className={style.notesCard}>
          <h2>Notas de la sesión</h2>
          <form className={style.noteForm} onSubmit={addNote}>
            <input
              className={style.noteInput}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="¿En qué estás trabajando?"
              maxLength={140}
            />
            <button type="submit" className={style.addBtn} aria-label="Agregar nota">
              +
            </button>
          </form>

          {notes.length === 0 ? (
            <p className={style.emptyNotes}>Sin notas todavía. Anotá tu objetivo del bloque.</p>
          ) : (
            <ul className={style.noteList}>
              {notes.map((it) => (
                <li key={it.id} className={style.noteItem}>
                  <input
                    type="checkbox"
                    className={style.noteCheck}
                    checked={it.done}
                    onChange={() => toggleNote(it.id)}
                  />
                  <span className={`${style.noteText} ${it.done ? style.noteDone : ""}`}>
                    {it.text}
                  </span>
                  <button
                    type="button"
                    className={style.noteDelete}
                    onClick={() => deleteNote(it.id)}
                    aria-label="Eliminar nota"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
