import { getDateOnlyValue, getIsoDate } from "./finance";

const DAY_CODES = ["D", "L", "M", "MI", "J", "V", "S"];

export const getTaskTargetDate = (value = new Date()) => getIsoDate(value);

const normalizeDayCode = (value) => String(value || "").trim().toUpperCase();

export const getTaskRepeatDays = (diasRepeticion) => {
  if (Array.isArray(diasRepeticion)) {
    return diasRepeticion.map(normalizeDayCode).filter(Boolean);
  }

  if (typeof diasRepeticion === "string") {
    return diasRepeticion.split(",").map(normalizeDayCode).filter(Boolean);
  }

  return [];
};

export const getTaskDayCode = (value = new Date()) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return DAY_CODES[date.getDay()] || "";
};

export const isTaskVisibleOnDate = (task, targetDateValue = new Date()) => {
  const targetDate = getTaskTargetDate(targetDateValue);
  const taskDate = getDateOnlyValue(task?.fecha);

  if (!targetDate || !taskDate) {
    return false;
  }

  if (task?.esRecurrente) {
    const repeatDays = getTaskRepeatDays(task.diasRepeticion);

    return (
      taskDate <= targetDate &&
      repeatDays.includes(getTaskDayCode(targetDateValue))
    );
  }

  return taskDate === targetDate;
};

export const isTaskCompletedOnDate = (task, targetDateValue = new Date()) => {
  const targetDate = getTaskTargetDate(targetDateValue);

  if (Array.isArray(task?.completadasEn)) {
    return task.completadasEn.includes(targetDate);
  }

  if (typeof task?.completada === "boolean") {
    return task.completada;
  }

  return false;
};

export const filterTasksForDate = (tasks = [], targetDateValue = new Date()) =>
  tasks.filter((task) => isTaskVisibleOnDate(task, targetDateValue));

export const summarizeTasksForDate = (tasks = [], targetDateValue = new Date()) => {
  const visibleTasks = filterTasksForDate(tasks, targetDateValue);
  const completed = visibleTasks.filter((task) =>
    isTaskCompletedOnDate(task, targetDateValue)
  ).length;

  return {
    pending: visibleTasks.length - completed,
    completed,
    total: visibleTasks.length,
  };
};
