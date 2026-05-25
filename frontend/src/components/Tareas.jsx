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
} from "../utils/tasks";
import { FiCalendar, FiChevronDown, FiPlus, FiX } from "react-icons/fi";

const getMonthInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const formatMonthTitle = (value) => {
  const [year, month] = value.split("-").map(Number);

  if (!year || !month) return "Mes";

  return new Date(year, month - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
};

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

const initialFormData = {
  meta: "",
  fecha: new Date(),
  horario: "12:00",
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

function Tareas({ refreshKey, onTaskSaved, activeWorkspace = "personal" }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(false);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedListMonth, setSelectedListMonth] = useState(getMonthInputValue(new Date()));
  const [updatingTaskIds, setUpdatingTaskIds] = useState([]);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
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
  const listTasks = useMemo(() => {
    const [year, month] = selectedListMonth.split("-").map(Number);
    const currentMonthValue = getMonthInputValue(new Date());

    if (!year || !month) {
      return tasks;
    }

    if (selectedListMonth > currentMonthValue) {
      return [];
    }

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    return tasks
      .filter((task) => {
        if (!task?.fecha) {
          return false;
        }

        const taskDate = new Date(task.fecha);

        if (task.esRecurrente) {
          return taskDate <= monthEnd;
        }

        return (
          taskDate.getFullYear() === monthStart.getFullYear() &&
          taskDate.getMonth() === monthStart.getMonth()
        );
      })
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [tasks, selectedListMonth]);
  const groupedListTasks = useMemo(() => {
    const grouped = listTasks.reduce((accumulator, task) => {
      const taskMonth = getMonthInputValue(new Date(task.fecha));

      if (!accumulator.has(taskMonth)) {
        accumulator.set(taskMonth, []);
      }

      accumulator.get(taskMonth).push(task);
      return accumulator;
    }, new Map());

    return [...grouped.entries()].map(([monthKey, monthTasks]) => ({
      key: monthKey,
      label: formatMonthTitle(monthKey),
      tasks: monthTasks,
    }));
  }, [listTasks]);
  const progressTasks = showList ? listTasks : visibleTasks;
  const completedTasksCount = progressTasks.filter((task) =>
    isTaskCompletedOnDate(task, showList ? task.fecha || selectedDate : selectedDate)
  ).length;
  const pendingTasksCount = Math.max(progressTasks.length - completedTasksCount, 0);
  const progressPercent = progressTasks.length
    ? Math.round((completedTasksCount / progressTasks.length) * 100)
    : 0;

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
      diasRepeticion: getTaskRepeatDays(task.diasRepeticion),
    });
    setFormError("");
    setFormSuccess("");
    setIsTaskModalOpen(true);
  };

  const handleOpenNewTask = () => {
    setEditingTask(null);
    setFormData(initialFormData);
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

      return (
        <div className={style.taskContainer} key={task._id}>
          <div
            className={`${style.taskCard} ${
              completed ? style.completed : ""
            } ${style[task.color] || style.color1}`}
          >
            <label className={style.checkboxWrapper}>
              <input
                type="checkbox"
                checked={completed}
                disabled={updatingTaskIds.includes(task._id)}
                onChange={() => handleToggleComplete(task._id)}
              />
              <span className={style.customCheckbox}></span>
            </label>

            <div className={style.taskHeader}>
              <p className={style.taskMeta}>{task.meta}</p>
              <p className={style.taskDate}>
                {task.fecha ? task.fecha.slice(0, 10) : "-"}
              </p>
            </div>

            <div className={style.taskInfoBlock}>
              <p className={style.taskUrgency}>{task.urgencia || "Normal"}</p>
            </div>

            <div className={style.taskDetails}>
              <span className={style.taskDetailsLabel}>Horario</span>
              <p>{task.horario || "Sin horario"}</p>
            </div>

            <div className={style.taskActions}>
              <button
                type="button"
                onClick={() => handleEditTask(task)}
                className={style.editButton}
                aria-label="Editar tarea"
              >
                <img className={style.ButtonImg} src="/edit.png" alt="edit" />
              </button>

              <button
                type="button"
                onClick={() => handleDeleteTask(task._id)}
                className={style.deleteButton}
                aria-label="Eliminar tarea"
              >
                <img className={style.ButtonImg} src="/trush.png" alt="delete" />
              </button>
            </div>
          </div>
        </div>
      );
    });
  };

  const renderListTable = () => {
    if (loading) return <p className={style.emptyMessage}>Cargando tareas...</p>;
    if (error) return <p className={style.errorMessage}>{error}</p>;
    if (!listTasks || listTasks.length === 0)
      return <p className={style.emptyMessage}>No hay tareas para este mes.</p>;

    return (
      <div className={style.taskListMode}>
        {groupedListTasks.map((group) => (
          <section key={group.key} className={style.listMonthGroup}>
            <div className={style.listMonthHeader}>
              <span>{group.label}</span>
            </div>

            <div className={style.listMonthRows}>
              {group.tasks.map((t) => {
                const completed = isTaskCompletedOnDate(t, t.fecha || selectedDate);

                return (
                  <div
                    key={t._id}
                    className={`${style.listRow} ${style[t.color] || style.color1} ${
                      completed ? style.completedListRow : ""
                    }`}
                  >
                    <label className={style.checkboxWrapper}>
                      <input
                        type="checkbox"
                        checked={completed}
                        disabled={updatingTaskIds.includes(t._id)}
                        onChange={() => handleToggleCompleteForDate(t._id, t.fecha || selectedDate)}
                      />
                      <span className={style.customCheckbox}></span>
                    </label>

                    <div className={style.listCopy}>
                      <p className={style.listTitle}>{t.meta}</p>
                      <div className={style.listMetaRow}>
                        <span className={style.listUrgency}>{t.urgencia || "Normal"}</span>
                        <span className={style.listState}>
                          {completed ? "Hecho" : "Pendiente"}
                        </span>
                      </div>
                    </div>

                    <div className={style.listSchedule}>
                      <span>Fecha</span>
                      <p>{t.fecha ? t.fecha.slice(0, 10) : "-"} · {t.horario || "--:--"}</p>
                    </div>

                    <div className={style.listActions}>
                      <button type="button" onClick={() => handleEditTask(t)}>Editar</button>
                      <button type="button" onClick={() => handleDeleteTask(t._id)}>Eliminar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
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
                {showList ? "Todas las tareas" : ""}
              </h1>

              <div className={style.containerFecha}>
                <p>{showList ? "Ver lista del mes" : "Tareas de"}</p>
                {!showList ? (
                  <DatePicker
                    selected={selectedDate}
                    onChange={handleDateChange}
                    dateFormat="dd-MM-yyyy"
                    customInput={<CalendarButton />}
                  />
                ) : (
                  <input
                    type="month"
                    value={selectedListMonth}
                    onChange={(event) => setSelectedListMonth(event.target.value)}
                    className={style.monthInput}
                  />
                )}
              </div>
            </div>

            <div className={style.headerAside}>
              {!showList ? (
                <button
                  type="button"
                  onClick={() => setShowList(true)}
                  className={`${style.viewButton} ${style.viewButtonAlt}`}
                >
                  Ver tareas en lista
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowList(false)}
                  className={style.viewButton}
                >
                  Volver a la vista diaria
                </button>
              )}

              <button type="button" className={style.newTaskButton} onClick={handleOpenNewTask}>
                <FiPlus />
                Nueva tarea
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={style.tasksWorkspace}>
        <div className={style.tasksList}>
          {showList ? renderListTable() : renderContent()}
        </div>

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
      </div>

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

              <div className={style.formGrid}>
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

                <label className={style.formField}>
                  <span>Hora</span>
                  <input
                    name="horario"
                    type="time"
                    value={formData.horario}
                    onChange={handleFormChange}
                  />
                </label>
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
