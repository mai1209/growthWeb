import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiPause, FiPlay, FiRotateCcw, FiSettings, FiSkipForward, FiX } from "react-icons/fi";
import style from "../style/Pomodoro.module.css";

const MODES = [
  { key: "focus", label: "Enfoque", defaultMin: 25 },
  { key: "short", label: "Descanso", defaultMin: 5 },
  { key: "long", label: "Descanso largo", defaultMin: 15 },
];

const SETTINGS_KEY = "gm_pomodoro_settings";
const NOTES_KEY = "gm_pomodoro_notes";
const COUNT_KEY = "gm_pomodoro_count";

const DEFAULT_SETTINGS = {
  focus: 25,
  short: 5,
  long: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  soundOn: true,
  alarmSound: "campana",
  alarmRepeat: 1,
  notificationsOn: false,
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const loadJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const SOUNDS = [
  { key: "campana", label: "Campana" },
  { key: "digital", label: "Digital" },
  { key: "alarma", label: "Alarma" },
];

let audioCtx = null;
const getCtx = () => {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
};

const tone = (ctx, { freq, start, dur, type = "sine", gain = 0.5 }) => {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(ctx.destination);
  const t0 = ctx.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
};

const SOUND_PLAYERS = {
  digital: (ctx, off) => {
    [0, 0.18, 0.36].forEach((t) =>
      tone(ctx, { freq: 1046, start: off + t, dur: 0.14, type: "square", gain: 0.55 })
    );
  },
  campana: (ctx, off) => {
    [
      [660, 0.6],
      [990, 0.5],
      [1320, 0.34],
      [1980, 0.2],
    ].forEach(([f, g]) => tone(ctx, { freq: f, start: off, dur: 1.5, type: "sine", gain: g }));
  },
  alarma: (ctx, off) => {
    for (let i = 0; i < 6; i += 1) {
      tone(ctx, {
        freq: i % 2 === 0 ? 880 : 1108,
        start: off + i * 0.16,
        dur: 0.14,
        type: "sawtooth",
        gain: 0.55,
      });
    }
  },
};

const playSound = (type, times) => {
  const ctx = getCtx();
  if (!ctx) return;
  const player = SOUND_PLAYERS[type] || SOUND_PLAYERS.campana;
  const n = Math.max(1, Number(times) || 1);
  const gap = type === "campana" ? 1.7 : type === "alarma" ? 1.1 : 0.7;
  try {
    for (let i = 0; i < n; i += 1) player(ctx, i * gap);
  } catch {
    // navegador sin audio o bloqueado
  }
};

const fmt = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export default function PomodoroPage() {
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...loadJSON(SETTINGS_KEY, {}),
  }));
  const [mode, setMode] = useState("focus");
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(settings.focus * 60);
  const [notes, setNotes] = useState(() => loadJSON(NOTES_KEY, []));
  const [noteText, setNoteText] = useState("");
  const [completed, setCompleted] = useState(() => {
    const saved = loadJSON(COUNT_KEY, null);
    return saved && saved.date === todayKey() ? saved.count : 0;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  const durations = { focus: settings.focus, short: settings.short, long: settings.long };
  const targetRef = useRef(null);
  const totalSecs = durations[mode] * 60;

  // Persistencia
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);
  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes]);
  useEffect(() => {
    localStorage.setItem(COUNT_KEY, JSON.stringify({ date: todayKey(), count: completed }));
  }, [completed]);

  const notify = useCallback((finishedMode) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const body =
      finishedMode === "focus"
        ? "¡Bloque de enfoque completado! Tomate un descanso."
        : "Descanso terminado. ¡A enfocarse!";
    try {
      new Notification("Pomodoro · Growth Manager", { body });
    } catch {
      // algunos navegadores requieren service worker; lo ignoramos
    }
  }, []);

  const handleComplete = useCallback(() => {
    if (settings.soundOn) playSound(settings.alarmSound, settings.alarmRepeat);
    if (settings.notificationsOn) notify(mode);
    targetRef.current = null;

    let next;
    let autostart;
    if (mode === "focus") {
      const newCount = completed + 1;
      setCompleted(newCount);
      const interval = Math.max(1, settings.longBreakInterval);
      next = newCount % interval === 0 ? "long" : "short";
      autostart = settings.autoStartBreaks;
    } else {
      next = "focus";
      autostart = settings.autoStartPomodoros;
    }
    setMode(next);
    setRemaining(durations[next] * 60);
    setRunning(autostart);
  }, [mode, completed, settings, notify]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const setField = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const changeDuration = (key, delta) => {
    setSettings((s) => {
      const val = Math.min(90, Math.max(1, s[key] + delta));
      if (key === mode && !running) {
        targetRef.current = null;
        setRemaining(val * 60);
      }
      return { ...s, [key]: val };
    });
  };

  const changeInterval = (delta) =>
    setSettings((s) => ({
      ...s,
      longBreakInterval: Math.min(12, Math.max(1, s.longBreakInterval + delta)),
    }));

  const changeAlarmRepeat = (delta) =>
    setSettings((s) => ({ ...s, alarmRepeat: Math.min(5, Math.max(1, s.alarmRepeat + delta)) }));

  const toggleNotifications = async () => {
    if (!settings.notificationsOn) {
      if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
        try {
          const perm = await Notification.requestPermission();
          if (perm !== "granted") return;
        } catch {
          return;
        }
      }
      setField("notificationsOn", true);
    } else {
      setField("notificationsOn", false);
    }
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
        <button
          type="button"
          className={style.gearBtn}
          onClick={() => setSettingsOpen(true)}
          title="Ajustes"
          aria-label="Ajustes"
        >
          <FiSettings size={20} />
        </button>
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
                  <stop offset="0%" stopColor="#14d95f" />
                  <stop offset="100%" stopColor="#10b5a4" />
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

      {/* Modal de Ajustes */}
      {settingsOpen ? (
        <div className={style.overlay} onClick={() => setSettingsOpen(false)}>
          <div className={style.modal} onClick={(e) => e.stopPropagation()}>
            <div className={style.modalHead}>
              <h3>Ajustes</h3>
              <button
                type="button"
                className={style.modalClose}
                onClick={() => setSettingsOpen(false)}
                aria-label="Cerrar"
              >
                <FiX size={20} />
              </button>
            </div>

            <div className={style.modalBody}>
              <div className={style.settingRow}>
                <span>Descanso largo cada</span>
                <div className={style.stepperInline}>
                  <button type="button" onClick={() => changeInterval(-1)}>
                    −
                  </button>
                  <span>{settings.longBreakInterval}</span>
                  <button type="button" onClick={() => changeInterval(1)}>
                    +
                  </button>
                </div>
              </div>

              <div className={style.settingRow}>
                <span>Auto-iniciar descansos</span>
                <button
                  type="button"
                  className={`${style.switch} ${settings.autoStartBreaks ? style.switchOn : ""}`}
                  onClick={() => setField("autoStartBreaks", !settings.autoStartBreaks)}
                  role="switch"
                  aria-checked={settings.autoStartBreaks}
                >
                  <span className={style.switchKnob} />
                </button>
              </div>

              <div className={style.settingRow}>
                <span>Auto-iniciar pomodoros</span>
                <button
                  type="button"
                  className={`${style.switch} ${settings.autoStartPomodoros ? style.switchOn : ""}`}
                  onClick={() => setField("autoStartPomodoros", !settings.autoStartPomodoros)}
                  role="switch"
                  aria-checked={settings.autoStartPomodoros}
                >
                  <span className={style.switchKnob} />
                </button>
              </div>

              <div className={style.settingRow}>
                <span>Sonido al terminar</span>
                <button
                  type="button"
                  className={`${style.switch} ${settings.soundOn ? style.switchOn : ""}`}
                  onClick={() => setField("soundOn", !settings.soundOn)}
                  role="switch"
                  aria-checked={settings.soundOn}
                >
                  <span className={style.switchKnob} />
                </button>
              </div>

              {settings.soundOn ? (
                <>
                  <div className={style.settingRow}>
                    <span>Tipo de sonido</span>
                    <div className={style.soundPicker}>
                      {SOUNDS.map((s) => (
                        <button
                          key={s.key}
                          type="button"
                          className={`${style.soundBtn} ${
                            settings.alarmSound === s.key ? style.soundBtnActive : ""
                          }`}
                          onClick={() => {
                            setField("alarmSound", s.key);
                            playSound(s.key, 1);
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={style.settingRow}>
                    <span>Repetir sonido</span>
                    <div className={style.stepperInline}>
                      <button type="button" onClick={() => changeAlarmRepeat(-1)}>
                        −
                      </button>
                      <span>{settings.alarmRepeat}×</span>
                      <button type="button" onClick={() => changeAlarmRepeat(1)}>
                        +
                      </button>
                    </div>
                  </div>

                  <div className={style.settingRow}>
                    <span>Probar sonido</span>
                    <button
                      type="button"
                      className={style.testBtn}
                      onClick={() => playSound(settings.alarmSound, settings.alarmRepeat)}
                    >
                      ▶ Probar
                    </button>
                  </div>
                </>
              ) : null}

              <div className={style.settingRow}>
                <span>Notificaciones del navegador</span>
                <button
                  type="button"
                  className={`${style.switch} ${settings.notificationsOn ? style.switchOn : ""}`}
                  onClick={toggleNotifications}
                  role="switch"
                  aria-checked={settings.notificationsOn}
                >
                  <span className={style.switchKnob} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
