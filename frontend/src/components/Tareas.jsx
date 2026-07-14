import { forwardRef, useCallback, useState, useEffect, useMemo } from "react";
import { taskService } from "../api"; // Importamos el servicio
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import style from "../style/Tarea.module.css";
import {
  filterTasksForDate,
  getTaskDayCode,
  getTaskRepeatDays,
  getTaskTargetDate,
  isTaskCompletedOnDate,
  summarizeTasksForDate,
} from "../utils/tasks";
import {
  FiBarChart2,
  FiCalendar,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiGrid,
  FiList,
  FiMinus,
  FiMoon,
  FiMoreVertical,
  FiPlus,
  FiSun,
  FiSunrise,
  FiEdit2,
  FiTrash2,
  FiX,
} from "react-icons/fi";

const CalendarButton = forwardRef(({ value, onClick }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    className={style.calendarTrigger}
  >
    <span className={style.calendarTriggerIcon}>
      <FiCalendar />
    </span>
    <span className={style.calendarTriggerText}>{value || "Seleccionar fecha"}</span>
    <FiChevronDown className={style.calendarTriggerChevron} />
  </button>
));

CalendarButton.displayName = "CalendarButton";

const FormDateButton = forwardRef(({ value, onClick }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    className={style.formDateButton}
  >
    <span className={style.formDateIcon}>
      <FiCalendar />
    </span>
    <span className={style.formDateCopy}>
      <small>Fecha</small>
      <strong>{value || "Seleccionar fecha"}</strong>
    </span>
    <FiChevronDown className={style.formDateChevron} />
  </button>
));

FormDateButton.displayName = "FormDateButton";

const MOMENTO_OPTIONS = [
  { value: "manana", label: "Mañana", horario: "Mañana", Icon: FiSunrise },
  { value: "tarde", label: "Tarde", horario: "Tarde", Icon: FiSun },
  { value: "noche", label: "Noche", horario: "Noche", Icon: FiMoon },
  { value: "indiferente", label: "Indiferente", horario: "", Icon: FiMinus },
];

const isExactTime = (horario) => /^\d{2}:\d{2}$/.test(String(horario || ""));

const deriveMomento = (horario) => {
  if (!horario) return "indiferente";
  if (horario === "Mañana") return "manana";
  if (horario === "Tarde") return "tarde";
  if (horario === "Noche") return "noche";
  return isExactTime(horario) ? "exacta" : "indiferente";
};

const initialFormData = {
  meta: "",
  fecha: new Date(),
  horario: "",
  momento: "indiferente",
  urgencia: "importante",
  color: "color1",
  esRecurrente: false,
  diasRepeticion: [],
};

const colorOptions = [
  "color1",
  "color2",
  "color3",
  "color4",
  "color5",
  "color6",
  "color7",
  "color8",
  "color9",
  "color10",
];

// ===== Helpers de Calendario / Historial =====
const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const HISTORY_PERIODS = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
];

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (value, amount) => {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
};

// Lunes = 0 ... Domingo = 6
const mondayIndex = (date) => (date.getDay() + 6) % 7;

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// 42 celdas (6 semanas) para la grilla del mes
const buildMonthGrid = (refDate) => {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const first = new Date(year, month, 1);
  const start = addDays(first, -mondayIndex(first));

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    return { date, inMonth: date.getMonth() === month };
  });
};

const getPeriodRange = (period, refDate) => {
  const day = startOfDay(refDate);

  if (period === "day") return { from: day, to: day };

  if (period === "week") {
    const from = addDays(day, -mondayIndex(day));
    return { from, to: addDays(from, 6) };
  }

  if (period === "year") {
    return {
      from: new Date(day.getFullYear(), 0, 1),
      to: new Date(day.getFullYear(), 11, 31),
    };
  }

  // month
  return {
    from: new Date(day.getFullYear(), day.getMonth(), 1),
    to: new Date(day.getFullYear(), day.getMonth() + 1, 0),
  };
};

const eachDayInRange = (from, to) => {
  const days = [];
  let current = startOfDay(from);
  const end = startOfDay(to);

  while (current <= end) {
    days.push(current);
    current = addDays(current, 1);
  }

  return days;
};

const shiftPeriod = (period, refDate, direction) => {
  const date = new Date(refDate);

  if (period === "day") date.setDate(date.getDate() + direction);
  else if (period === "week") date.setDate(date.getDate() + direction * 7);
  else if (period === "month") date.setMonth(date.getMonth() + direction);
  else date.setFullYear(date.getFullYear() + direction);

  return date;
};

const formatPeriodLabel = (period, refDate) => {
  const { from, to } = getPeriodRange(period, refDate);

  if (period === "day") {
    return from.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  if (period === "year") return String(refDate.getFullYear());

  if (period === "month") {
    return from.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  }

  const opts = { day: "2-digit", month: "short" };
  return `${from.toLocaleDateString("es-AR", opts)} – ${to.toLocaleDateString("es-AR", opts)}`;
};

// Rendimiento del período: solo cuenta días hasta hoy
const summarizePeriod = (tasks, from, to) => {
  const today = startOfDay(new Date());
  const days = eachDayInRange(from, to).filter((day) => day <= today);

  let total = 0;
  let done = 0;

  const perUnit = days.map((day) => {
    const summary = summarizeTasksForDate(tasks, day);
    total += summary.total;
    done += summary.completed;
    return { day, ...summary };
  });

  return {
    total,
    done,
    pending: Math.max(total - done, 0),
    percent: total ? Math.round((done / total) * 100) : 0,
    perUnit,
  };
};

function Tareas({ refreshKey, onTaskSaved, activeWorkspace = "personal" }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  // Vista activa: "day" (diaria) | "calendar" (calendario) | "history" (historial)
  const [viewMode, setViewMode] = useState("day");
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarRef, setCalendarRef] = useState(new Date()); // mes que muestra el calendario
  const [historyPeriod, setHistoryPeriod] = useState("month"); // día/semana/mes/año
  const [historyRef, setHistoryRef] = useState(new Date()); // período de referencia del historial
  const [updatingTaskIds, setUpdatingTaskIds] = useState([]);
  const [openTaskMenu, setOpenTaskMenu] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [dayActionDate, setDayActionDate] = useState(null); // día tocado en el calendario
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [isTaskDatePickerOpen, setIsTaskDatePickerOpen] = useState(false);

  const visibleTasks = useMemo(
    () => filterTasksForDate(tasks, selectedDate),
    [tasks, selectedDate]
  );
  // Grilla del mes para la vista calendario
  const calendarCells = useMemo(() => buildMonthGrid(calendarRef), [calendarRef]);

  // Rango y rendimiento del historial (según día/semana/mes/año)
  const periodRange = useMemo(
    () => getPeriodRange(historyPeriod, historyRef),
    [historyPeriod, historyRef]
  );
  const historySummary = useMemo(
    () => summarizePeriod(tasks, periodRange.from, periodRange.to),
    [tasks, periodRange]
  );

  // Resumen del día seleccionado (vista diaria) — normalizado a { total, done, pending, percent }
  const daySummary = useMemo(() => {
    const s = summarizeTasksForDate(tasks, selectedDate);
    return {
      total: s.total,
      done: s.completed,
      pending: s.pending,
      percent: s.total ? Math.round((s.completed / s.total) * 100) : 0,
    };
  }, [tasks, selectedDate]);

  // Resumen del mes que muestra el calendario
  const calendarMonthSummary = useMemo(() => {
    const { from, to } = getPeriodRange("month", calendarRef);
    return summarizePeriod(tasks, from, to);
  }, [tasks, calendarRef]);

  // El anillo de progreso refleja la vista activa
  const activeSummary =
    viewMode === "history"
      ? historySummary
      : viewMode === "calendar"
        ? calendarMonthSummary
        : daySummary;
  const completedTasksCount = activeSummary.done;
  const pendingTasksCount = activeSummary.pending;
  const progressPercent = activeSummary.percent;

  const fetchTasks = useCallback(async () => {
    const storedToken = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!storedToken) return;

    setLoading(true);
    try {
      const res = await taskService.getAll({ tipo: "task", workspace: activeWorkspace });
      setTasks(Array.isArray(res.data) ? res.data : []);
      setError("");
    } catch (err) {
      setError("No se pudieron cargar las tareas.");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks, refreshKey]);

  const getStatusDate = (value) => {
    if (typeof value === "string") {
      return value.slice(0, 10);
    }

    return getTaskTargetDate(value);
  };

  const handleToggleCompleteForDate = async (taskId, dateValue = selectedDate) => {
    const fecha = getStatusDate(dateValue);
    const targetTask = tasks.find((task) => task._id === taskId);

    if (!targetTask || updatingTaskIds.includes(taskId)) {
      return;
    }

    const previousCompletadasEn = Array.isArray(targetTask.completadasEn)
      ? targetTask.completadasEn
      : [];
    const nextCompletadasEn = previousCompletadasEn.includes(fecha)
      ? previousCompletadasEn.filter((item) => item !== fecha)
      : [...previousCompletadasEn, fecha];

    setUpdatingTaskIds((prev) => [...prev, taskId]);
    setTasks((prev) =>
      prev.map((task) =>
        task._id === taskId
          ? {
              ...task,
              completadasEn: nextCompletadasEn,
            }
          : task
      )
    );

    try {
      const res = await taskService.updateStatus(taskId, { fecha });
      setTasks((prev) =>
        prev.map((task) =>
          task._id === taskId
            ? {
                ...task,
                ...res.data,
                completadasEn: Array.isArray(res.data?.completadasEn)
                  ? res.data.completadasEn
                  : nextCompletadasEn,
              }
            : task
        )
      );
    } catch (err) {
      setTasks((prev) =>
        prev.map((task) =>
          task._id === taskId
            ? {
                ...task,
                completadasEn: previousCompletadasEn,
              }
            : task
        )
      );
      console.error("Error al actualizar estado");
    } finally {
      setUpdatingTaskIds((prev) => prev.filter((id) => id !== taskId));
    }
  };

  const handleToggleComplete = (taskId) => {
    handleToggleCompleteForDate(taskId, selectedDate);
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("¿Eliminar tarea?")) return;
    try {
      await taskService.delete( taskId);
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
      setError("");
    } catch (err) {
      console.error("Error al eliminar");
      setError("No se pudo eliminar la tarea.");
    }
  };

  const handleEditTask = (task) => {
    const fechaUTC = new Date(task.fecha || new Date());
    fechaUTC.setMinutes(fechaUTC.getMinutes() + fechaUTC.getTimezoneOffset());

    setEditingTask(task);
    setFormData({
      ...initialFormData,
      ...task,
      fecha: fechaUTC,
      momento: deriveMomento(task.horario),
      diasRepeticion: getTaskRepeatDays(task.diasRepeticion),
    });
    setFormError("");
    setFormSuccess("");
    setIsTaskModalOpen(true);
  };

  const handleOpenNewTask = (presetDate) => {
    // Si viene una fecha válida (ej. desde el calendario), la pre-cargamos
    const fecha =
      presetDate instanceof Date && !Number.isNaN(presetDate.getTime())
        ? new Date(presetDate)
        : new Date();

    setEditingTask(null);
    setFormData({ ...initialFormData, fecha });
    setFormError("");
    setFormSuccess("");
    setIsTaskDatePickerOpen(false);
    setIsTaskModalOpen(true);
  };

  const handleCloseTaskModal = () => {
    setIsTaskModalOpen(false);
    setEditingTask(null);
    setFormData(initialFormData);
    setFormError("");
    setFormSuccess("");
    setIsTaskDatePickerOpen(false);
  };

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    if (name === "esRecurrente") {
      setFormData((prev) => {
        const currentDays = getTaskRepeatDays(prev.diasRepeticion);
        const currentDay = getTaskDayCode(prev.fecha);

        return {
          ...prev,
          esRecurrente: checked,
          diasRepeticion: checked
            ? currentDays.length > 0
              ? currentDays
              : currentDay
                ? [currentDay]
                : []
            : [],
        };
      });
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleTaskDateChange = (date) => {
    if (!date) return;
    setFormData((prev) => ({ ...prev, fecha: date }));
    setIsTaskDatePickerOpen(false);
  };

  const handleColorSelect = (color) => {
    setFormData((prev) => ({ ...prev, color }));
  };

  const handleMomentoSelect = (value) => {
    setFormData((prev) => {
      if (value === "exacta") {
        return {
          ...prev,
          momento: "exacta",
          horario: isExactTime(prev.horario) ? prev.horario : "09:00",
        };
      }

      const option = MOMENTO_OPTIONS.find((item) => item.value === value);
      return { ...prev, momento: value, horario: option ? option.horario : "" };
    });
  };

  const toggleRepeatDay = (dia) => {
    setFormData((prev) => {
      const currentDays = getTaskRepeatDays(prev.diasRepeticion);

      return {
        ...prev,
        diasRepeticion: currentDays.includes(dia)
          ? currentDays.filter((item) => item !== dia)
          : [...currentDays, dia],
      };
    });
  };

  const handleTaskSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!formData.meta.trim()) {
      setFormError("Escribe el nombre de la tarea.");
      return;
    }

    const repeatDays = getTaskRepeatDays(formData.diasRepeticion);

    if (formData.esRecurrente && repeatDays.length === 0) {
      setFormError("Elige al menos un dia para repetir la tarea.");
      return;
    }

    setFormSaving(true);

    try {
      const fechaLocal = new Date(formData.fecha);
      fechaLocal.setMinutes(fechaLocal.getMinutes() - fechaLocal.getTimezoneOffset());

      const payload = {
        ...formData,
        meta: formData.meta.trim(),
        tipo: "task",
        workspace: activeWorkspace,
        fecha: fechaLocal.toISOString().slice(0, 10),
        diasRepeticion: formData.esRecurrente ? repeatDays : [],
      };

      if (editingTask?._id) {
        await taskService.update(editingTask._id, payload);
        setFormSuccess("Tarea actualizada.");
      } else {
        await taskService.create(payload);
        setFormSuccess("Tarea creada.");
      }

      await fetchTasks();
      onTaskSaved?.();

      setTimeout(() => {
        handleCloseTaskModal();
      }, 450);
    } catch (err) {
      setFormError(err.response?.data?.message || "No se pudo guardar la tarea.");
    } finally {
      setFormSaving(false);
    }
  };

  const isTaskCompleted = (task) => {
    return isTaskCompletedOnDate(task, selectedDate);
  };

  const renderContent = () => {
    if (loading) return <p className={style.emptyMessage}>Cargando tareas...</p>;
    if (error) return <p className={style.errorMessage}>{error}</p>;
    if (visibleTasks.length === 0)
      return (
        <p className={style.emptyMessage}>
          Aun no tienes tareas. Anade una para comenzar.
        </p>
      );

    return visibleTasks.map((task) => {
      const completed = isTaskCompleted(task);

      const menuOpen = openTaskMenu === task._id;

      return (
        <div className={style.taskContainer} key={task._id}>
          <div
            className={`${style.taskCard} ${
              completed ? style.completed : ""
            } ${style[task.color] || style.color1}`}
            style={
              task.color?.startsWith?.("#") ? { background: task.color } : undefined
            }
          >
            <div className={style.taskTop}>
              {/* Izquierda: opciones (tres puntitos) */}
              <button
                type="button"
                className={style.taskOptionsBtn}
                onClick={() => setOpenTaskMenu(menuOpen ? null : task._id)}
                aria-label="Opciones"
                aria-expanded={menuOpen}
              >
                <FiMoreVertical />
              </button>

              <div className={style.taskBody}>
                <p className={style.taskMeta}>{task.meta}</p>
                <div className={style.taskMetaRow}>
                  <span className={`${style.taskChip} ${style.taskDate}`}>
                    <FiCalendar />
                    {task.fecha ? task.fecha.slice(0, 10) : "-"}
                  </span>
                  <span className={`${style.taskChip} ${style.taskUrgency}`}>
                    {task.urgencia || "Normal"}
                  </span>
                  <span className={`${style.taskChip} ${style.taskSchedule}`}>
                    <FiClock />
                    {task.horario || "Sin horario"}
                  </span>
                </div>
              </div>

              {/* Derecha: check circular (se pinta verde al completar) */}
              <button
                type="button"
                className={`${style.taskCheckCircle} ${completed ? style.taskCheckDone : ""}`}
                onClick={() => handleToggleComplete(task._id)}
                disabled={updatingTaskIds.includes(task._id)}
                aria-label={completed ? "Marcar como pendiente" : "Completar"}
              />
            </div>

            {/* Fila desplegable con editar / eliminar */}
            {menuOpen ? (
              <div className={style.taskExpanded}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenTaskMenu(null);
                    handleEditTask(task);
                  }}
                  className={style.taskExpandedBtn}
                >
                  <FiEdit2 /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenTaskMenu(null);
                    handleDeleteTask(task._id);
                  }}
                  className={`${style.taskExpandedBtn} ${style.taskExpandedDelete}`}
                >
                  <FiTrash2 /> Eliminar
                </button>
              </div>
            ) : null}
          </div>
        </div>
      );
    });
  };

  const renderCalendar = () => {
    if (loading) return <p className={style.emptyMessage}>Cargando tareas...</p>;
    if (error) return <p className={style.errorMessage}>{error}</p>;

    const today = new Date();

    return (
      <div className={style.calendarMode}>
        <div className={style.calendarNav}>
          <button
            type="button"
            onClick={() => setCalendarRef((prev) => shiftPeriod("month", prev, -1))}
            aria-label="Mes anterior"
          >
            <FiChevronLeft />
          </button>
          <span>
            {calendarRef.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
          </span>
          <button
            type="button"
            onClick={() => setCalendarRef((prev) => shiftPeriod("month", prev, 1))}
            aria-label="Mes siguiente"
          >
            <FiChevronRight />
          </button>
        </div>

        <div className={style.calendarWeekdays}>
          {WEEKDAY_LABELS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        <div className={style.calendarGrid}>
          {calendarCells.map(({ date, inMonth }, index) => {
            const dayTasks = filterTasksForDate(tasks, date);
            const isToday = isSameDay(date, today);

            return (
              <button
                type="button"
                key={index}
                className={`${style.calendarCell} ${inMonth ? "" : style.calendarCellMuted} ${
                  isToday ? style.calendarCellToday : ""
                }`}
                onClick={() => setDayActionDate(date)}
                title={`${dayTasks.length} tarea(s)`}
              >
                <span className={style.calendarDayNumber}>{date.getDate()}</span>
                <span className={style.calendarDots}>
                  {dayTasks.slice(0, 4).map((t) => {
                    const done = isTaskCompletedOnDate(t, date);
                    return (
                      <span
                        key={t._id}
                        className={`${style.calendarDot} ${style[t.color] || style.color1} ${
                          done ? style.calendarDotDone : ""
                        }`}
                        style={
                          t.color?.startsWith?.("#") ? { background: t.color } : undefined
                        }
                      />
                    );
                  })}
                  {dayTasks.length > 4 ? (
                    <span className={style.calendarMore}>+{dayTasks.length - 4}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const buildHistoryBuckets = () => {
    if (historyPeriod === "year") {
      const months = Array.from({ length: 12 }, (_, m) => ({
        label: new Date(2000, m, 1).toLocaleDateString("es-AR", { month: "short" }),
        total: 0,
        done: 0,
      }));
      historySummary.perUnit.forEach((u) => {
        const m = u.day.getMonth();
        months[m].total += u.total;
        months[m].done += u.completed;
      });
      return months.map((b) => ({
        ...b,
        percent: b.total ? Math.round((b.done / b.total) * 100) : 0,
      }));
    }

    return historySummary.perUnit.map((u) => ({
      label:
        historyPeriod === "week"
          ? WEEKDAY_LABELS[mondayIndex(u.day)]
          : String(u.day.getDate()),
      total: u.total,
      done: u.completed,
      percent: u.total ? Math.round((u.completed / u.total) * 100) : 0,
    }));
  };

  const renderHistory = () => {
    if (loading) return <p className={style.emptyMessage}>Cargando tareas...</p>;
    if (error) return <p className={style.errorMessage}>{error}</p>;

    const buckets = buildHistoryBuckets();

    return (
      <div className={style.historyMode}>
        <div className={style.historyControls}>
          <div className={style.historyPeriods}>
            {HISTORY_PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`${style.historyPeriodButton} ${
                  historyPeriod === p.value ? style.historyPeriodActive : ""
                }`}
                onClick={() => setHistoryPeriod(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className={style.historyNav}>
            <button
              type="button"
              onClick={() => setHistoryRef((prev) => shiftPeriod(historyPeriod, prev, -1))}
              aria-label="Período anterior"
            >
              <FiChevronLeft />
            </button>
            <span>{formatPeriodLabel(historyPeriod, historyRef)}</span>
            <button
              type="button"
              onClick={() => setHistoryRef((prev) => shiftPeriod(historyPeriod, prev, 1))}
              aria-label="Período siguiente"
            >
              <FiChevronRight />
            </button>
          </div>
        </div>

        <div className={style.historyStats}>
          <div className={style.historyStat}>
            <strong>{historySummary.percent}%</strong>
            <span>rendimiento</span>
          </div>
          <div className={style.historyStat}>
            <strong>{historySummary.total}</strong>
            <span>tareas</span>
          </div>
          <div className={style.historyStat}>
            <strong>{historySummary.done}</strong>
            <span>hechas</span>
          </div>
          <div className={style.historyStat}>
            <strong>{historySummary.pending}</strong>
            <span>pendientes</span>
          </div>
        </div>

        {historySummary.total === 0 ? (
          <p className={style.emptyMessage}>No hay tareas en este período.</p>
        ) : (
          <>
            <div className={style.historyChart}>
              {buckets.map((b, index) => (
                <div
                  key={index}
                  className={style.historyBar}
                  title={`${b.label}: ${b.done}/${b.total} (${b.percent}%)`}
                >
                  <div className={style.historyBarTrack}>
                    <div
                      className={style.historyBarFill}
                      style={{ height: `${b.percent}%` }}
                    />
                  </div>
                  <span className={style.historyBarLabel}>{b.label}</span>
                </div>
              ))}
            </div>

            <p className={style.historyLegend}>
              Cada barra muestra el <strong>% de tareas completadas</strong>
              {historyPeriod === "year"
                ? " en cada mes"
                : historyPeriod === "week"
                ? " en cada día de la semana"
                : historyPeriod === "month"
                ? " en cada día del mes"
                : " del día"}
              . Pasá el cursor por una barra para ver <strong>hechas / total</strong>.
            </p>
          </>
        )}
      </div>
    );
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  return (
    <div className={style.container}>
      <div className={style.headerShell}>
        <div className={style.headerCard}>
          <div className={style.headerTop}>
            <div className={style.headerCopy}>
              <p className={style.kicker}>Panel de tareas</p>
              <h1 className={style.pageTitle}>
                {viewMode === "calendar"
                  ? "Calendario"
                  : viewMode === "history"
                    ? "Historial"
                    : ""}
              </h1>

              {viewMode === "day" ? (
                <div className={style.containerFecha}>
                  <p>Tareas de</p>
                  <DatePicker
                    selected={selectedDate}
                    onChange={handleDateChange}
                    dateFormat="dd-MM-yyyy"
                    customInput={<CalendarButton />}
                  />
                </div>
              ) : (
                <p className={style.viewSubtitle}>
                  {viewMode === "calendar"
                    ? "Tocá un día para ver sus tareas"
                    : "Tu rendimiento por día, semana, mes o año"}
                </p>
              )}
            </div>

            <div className={style.headerAside}>
              <div className={style.viewSwitch}>
                <button
                  type="button"
                  className={`${style.viewSwitchButton} ${
                    viewMode === "day" ? style.viewSwitchActive : ""
                  }`}
                  onClick={() => setViewMode("day")}
                >
                  <FiList />
                  Día
                </button>
                <button
                  type="button"
                  className={`${style.viewSwitchButton} ${
                    viewMode === "calendar" ? style.viewSwitchActive : ""
                  }`}
                  onClick={() => setViewMode("calendar")}
                >
                  <FiGrid />
                  Calendario
                </button>
                <button
                  type="button"
                  className={`${style.viewSwitchButton} ${
                    viewMode === "history" ? style.viewSwitchActive : ""
                  }`}
                  onClick={() => setViewMode("history")}
                >
                  <FiBarChart2 />
                  Historial
                </button>

                <button
                  type="button"
                  className={`${style.viewSwitchButton} ${style.viewSwitchAction}`}
                  onClick={() => handleOpenNewTask()}
                >
                  <FiPlus />
                  Nueva tarea
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={style.tasksWorkspace}>
        <aside className={style.progressCard} aria-label="Progreso de tareas">
          <div
            className={style.progressRing}
            style={{ "--progress": `${progressPercent}%` }}
          >
            <div className={style.progressRingInner}>
              <strong>{progressPercent}%</strong>
              <span>hecho</span>
            </div>
          </div>

          <div className={style.progressCopy}>
            <span className={style.progressLabel}>Progreso</span>
            <div className={style.progressStats}>
              <p>
                <strong>{completedTasksCount}</strong>
                completadas
              </p>
              <p>
                <strong>{pendingTasksCount}</strong>
                pendientes
              </p>
            </div>
          </div>
        </aside>

        <div className={style.tasksList}>
          {viewMode === "calendar"
            ? renderCalendar()
            : viewMode === "history"
              ? renderHistory()
              : renderContent()}
        </div>
      </div>

      {dayActionDate ? (
        <div
          className={style.taskModalOverlay}
          role="presentation"
          onMouseDown={() => setDayActionDate(null)}
        >
          <section
            className={style.dayActionSheet}
            role="dialog"
            aria-modal="true"
            aria-label="Acción del día"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={style.dayActionHeader}>
              <p className={style.kicker}>Día seleccionado</p>
              <h2>
                {dayActionDate.toLocaleDateString("es-AR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
              </h2>
            </div>

            <div className={style.dayActionButtons}>
              <button
                type="button"
                className={style.dayActionPrimary}
                onClick={() => {
                  const date = dayActionDate;
                  setDayActionDate(null);
                  setSelectedDate(date);
                  handleOpenNewTask(date);
                }}
              >
                <FiPlus />
                Crear tarea
              </button>

              <button
                type="button"
                className={style.dayActionSecondary}
                onClick={() => {
                  const date = dayActionDate;
                  setDayActionDate(null);
                  setSelectedDate(date);
                  setViewMode("day");
                }}
              >
                <FiList />
                Ver tareas del día
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isTaskModalOpen ? (
        <div className={style.taskModalOverlay} role="presentation" onMouseDown={handleCloseTaskModal}>
          <section
            className={style.taskModal}
            role="dialog"
            aria-modal="true"
            aria-label={editingTask ? "Editar tarea" : "Nueva tarea"}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={style.taskModalHeader}>
              <div>
                <p className={style.kicker}>Tarea</p>
                <h2>{editingTask ? "Editar tarea" : "Nueva tarea"}</h2>
              </div>
              <button type="button" className={style.closeModalButton} onClick={handleCloseTaskModal}>
                <FiX />
              </button>
            </div>

            {formError ? <p className={style.modalError}>{formError}</p> : null}
            {formSuccess ? <p className={style.modalSuccess}>{formSuccess}</p> : null}

            <form className={style.taskForm} onSubmit={handleTaskSubmit}>
              <label className={style.formField}>
                <span>Tarea</span>
                <input
                  name="meta"
                  type="text"
                  value={formData.meta}
                  onChange={handleFormChange}
                  placeholder="Ej: Revisar pedidos"
                />
              </label>

              <div className={style.formField}>
                <DatePicker
                  selected={formData.fecha}
                  onChange={handleTaskDateChange}
                  dateFormat="dd-MM-yyyy"
                  customInput={<FormDateButton />}
                  open={isTaskDatePickerOpen}
                  onInputClick={() => setIsTaskDatePickerOpen((prev) => !prev)}
                  onClickOutside={() => setIsTaskDatePickerOpen(false)}
                  onCalendarClose={() => setIsTaskDatePickerOpen(false)}
                  shouldCloseOnSelect
                  popperClassName={style.taskDatepickerPopper}
                />
              </div>

              <div className={style.formField}>
                <span>Momento</span>
                <div className={style.momentoGrid}>
                  {MOMENTO_OPTIONS.map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      className={`${style.momentoButton} ${
                        formData.momento === value ? style.momentoButtonActive : ""
                      }`}
                      onClick={() => handleMomentoSelect(value)}
                    >
                      <Icon />
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`${style.momentoButton} ${
                      formData.momento === "exacta" ? style.momentoButtonActive : ""
                    }`}
                    onClick={() => handleMomentoSelect("exacta")}
                  >
                    <FiClock />
                    Hora exacta
                  </button>
                </div>

                {formData.momento === "exacta" ? (
                  <input
                    className={style.momentoTimeInput}
                    name="horario"
                    type="time"
                    value={isExactTime(formData.horario) ? formData.horario : ""}
                    onChange={handleFormChange}
                  />
                ) : null}
              </div>

              <label className={style.formField}>
                <span>Prioridad</span>
                <select name="urgencia" value={formData.urgencia} onChange={handleFormChange}>
                  <option value="importante">Importante</option>
                  <option value="urgente">Urgente</option>
                  <option value="no importante">No importante</option>
                  <option value="obligaciones">Obligaciones</option>
                </select>
              </label>

              <div className={style.formField}>
                <span>Color</span>
                <div className={style.taskColorPicker}>
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`${style.taskColorButton} ${style[color]} ${
                        formData.color === color ? style.taskColorSelected : ""
                      }`}
                      onClick={() => handleColorSelect(color)}
                      aria-label={`Elegir color ${color}`}
                    />
                  ))}
                </div>
              </div>

              <label className={style.repeatToggle}>
                <input
                  name="esRecurrente"
                  type="checkbox"
                  checked={formData.esRecurrente}
                  onChange={handleFormChange}
                />
                <span>Repetir tarea</span>
              </label>

              {formData.esRecurrente ? (
                <div className={style.daysPicker}>
                  {["D", "L", "M", "MI", "J", "V", "S"].map((dia) => (
                    <label key={dia} className={style.dayChip}>
                      <input
                        type="checkbox"
                        checked={getTaskRepeatDays(formData.diasRepeticion).includes(dia)}
                        onChange={() => toggleRepeatDay(dia)}
                      />
                      <span>{dia}</span>
                    </label>
                  ))}
                </div>
              ) : null}

              <div className={style.modalActions}>
                <button type="button" className={style.cancelButton} onClick={handleCloseTaskModal}>
                  Cancelar
                </button>
                <button type="submit" className={style.saveTaskButton} disabled={formSaving}>
                  {formSaving ? "Guardando..." : editingTask ? "Guardar cambios" : "Crear tarea"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default Tareas;
