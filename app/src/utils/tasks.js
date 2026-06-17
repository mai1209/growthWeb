// Lógica de tareas portada de la web (recurrentes + completadas por día).
const DAY_CODES = ["D", "L", "M", "MI", "J", "V", "S"];

const pad = (n) => String(n).padStart(2, "0");

export const getIsoDate = (value = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const getDateOnlyValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const normalizeDayCode = (v) => String(v || "").trim().toUpperCase();

export const getTaskRepeatDays = (dias) => {
  if (Array.isArray(dias)) return dias.map(normalizeDayCode).filter(Boolean);
  if (typeof dias === "string") return dias.split(",").map(normalizeDayCode).filter(Boolean);
  return [];
};

export const getTaskDayCode = (value = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return DAY_CODES[date.getDay()] || "";
};

export const isTaskVisibleOnDate = (task, targetValue = new Date()) => {
  const targetDate = getIsoDate(targetValue);
  const taskDate = getDateOnlyValue(task?.fecha);
  if (!targetDate || !taskDate) return false;

  if (task?.esRecurrente) {
    const repeatDays = getTaskRepeatDays(task.diasRepeticion);
    return taskDate <= targetDate && repeatDays.includes(getTaskDayCode(targetValue));
  }
  return taskDate === targetDate;
};

export const isTaskCompletedOnDate = (task, targetValue = new Date()) => {
  const targetDate = getIsoDate(targetValue);
  if (Array.isArray(task?.completadasEn)) return task.completadasEn.includes(targetDate);
  if (typeof task?.completada === "boolean") return task.completada;
  return false;
};

export const filterTasksForDate = (tasks = [], targetValue = new Date()) =>
  tasks.filter((t) => isTaskVisibleOnDate(t, targetValue));

// ===== Helpers de Calendario / Historial (portados de la web) =====
export const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export const HISTORY_PERIODS = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "year", label: "Año" },
];

export const startOfDay = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const addDays = (value, amount) => {
  const d = new Date(value);
  d.setDate(d.getDate() + amount);
  return d;
};

const mondayIndex = (date) => (date.getDay() + 6) % 7;

export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const buildMonthGrid = (refDate) => {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const first = new Date(year, month, 1);
  const start = addDays(first, -mondayIndex(first));
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i);
    return { date, inMonth: date.getMonth() === month };
  });
};

export const getPeriodRange = (period, refDate) => {
  const day = startOfDay(refDate);
  if (period === "day") return { from: day, to: day };
  if (period === "week") {
    const from = addDays(day, -mondayIndex(day));
    return { from, to: addDays(from, 6) };
  }
  if (period === "year") {
    return { from: new Date(day.getFullYear(), 0, 1), to: new Date(day.getFullYear(), 11, 31) };
  }
  return {
    from: new Date(day.getFullYear(), day.getMonth(), 1),
    to: new Date(day.getFullYear(), day.getMonth() + 1, 0),
  };
};

export const eachDayInRange = (from, to) => {
  const days = [];
  let cur = startOfDay(from);
  const end = startOfDay(to);
  while (cur <= end) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
};

export const shiftPeriod = (period, refDate, dir) => {
  const d = new Date(refDate);
  if (period === "day") d.setDate(d.getDate() + dir);
  else if (period === "week") d.setDate(d.getDate() + dir * 7);
  else if (period === "month") d.setMonth(d.getMonth() + dir);
  else d.setFullYear(d.getFullYear() + dir);
  return d;
};

export const formatPeriodLabel = (period, refDate) => {
  const { from, to } = getPeriodRange(period, refDate);
  if (period === "day")
    return from.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" });
  if (period === "year") return String(refDate.getFullYear());
  if (period === "month")
    return from.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const o = { day: "2-digit", month: "short" };
  return `${from.toLocaleDateString("es-AR", o)} – ${to.toLocaleDateString("es-AR", o)}`;
};

export const summarizeTasksForDate = (tasks, date) => {
  const visible = filterTasksForDate(tasks, date);
  const completed = visible.filter((t) => isTaskCompletedOnDate(t, date)).length;
  return { total: visible.length, completed, pending: visible.length - completed };
};

// Rendimiento del período: solo cuenta días hasta hoy
export const summarizePeriod = (tasks, from, to) => {
  const today = startOfDay(new Date());
  const days = eachDayInRange(from, to).filter((d) => d <= today);
  let total = 0;
  let done = 0;
  const perUnit = days.map((day) => {
    const s = summarizeTasksForDate(tasks, day);
    total += s.total;
    done += s.completed;
    return { day, ...s };
  });
  return { total, done, pending: Math.max(total - done, 0), percent: total ? Math.round((done / total) * 100) : 0, perUnit };
};
