import { getDateOnlyValue, getIsoDate } from "./finance";

const DAY_CODES = ["D", "L", "M", "MI", "J", "V", "S"];

export const getTaskTargetDate = (value = new Date()) => getIsoDate(value);

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
    return (
      taskDate <= targetDate &&
      Array.isArray(task.diasRepeticion) &&
      task.diasRepeticion.includes(getTaskDayCode(targetDateValue))
    );
  }

  return taskDate === targetDate;
};

export const isTaskCompletedOnDate = (task, targetDateValue = new Date()) => {
  if (typeof task?.completada === "boolean") {
    return task.completada;
  }

  const targetDate = getTaskTargetDate(targetDateValue);

  return Array.isArray(task?.completadasEn)
    ? task.completadasEn.includes(targetDate)
    : false;
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
