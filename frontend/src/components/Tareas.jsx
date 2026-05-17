import { forwardRef, useState, useEffect, useMemo } from "react";
import { taskService } from "../api"; // Importamos el servicio
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import style from "../style/Tarea.module.css";
import { useOutletContext } from "react-router-dom";
import { filterTasksForDate, getTaskTargetDate, isTaskCompletedOnDate } from "../utils/tasks";
import { FiCalendar, FiChevronDown } from "react-icons/fi";

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

function Tareas({  refreshKey, onEditClick }) {
  const { isNotesOpen, openNotesPanel } = useOutletContext();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(false);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedListMonth, setSelectedListMonth] = useState(getMonthInputValue(new Date()));
  const [updatingTaskIds, setUpdatingTaskIds] = useState([]);

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

  useEffect(() => {
    let isMounted = true;

    const fetchTasks = async () => {
      const storedToken = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!storedToken) return;


      setLoading(true);
      try {
        const res = await taskService.getAll({ tipo: "task" });
        if (isMounted) {
          setTasks(res.data);
          setError("");
        }
      } catch (err) {
       if (isMounted) setError("No se pudieron cargar las tareas.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTasks();
    return () => { isMounted = false; };
  }, [refreshKey]);

  const handleToggleComplete = async (taskId) => {
    const fecha = getTaskTargetDate(selectedDate);
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
    onEditClick(task);
    openNotesPanel?.();
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
                    className={`${style.listRow} ${
                      completed ? style.completedListRow : ""
                    }`}
                  >
                    <div className={style.listCopy}>
                      <p className={style.listTitle}>{t.meta}</p>
                      <div className={style.listMetaRow}>
                        <span className={style.listUrgency}>{t.urgencia || "Normal"}</span>
                        <span className={style.listState}>
                          {completed ? "Hecho" : "Pendiente"}
                        </span>
                      </div>
                    </div>

                    <p className={style.listSchedule}>
                      {t.fecha ? t.fecha.slice(0, 10) : "-"} · {t.horario || "--:--"}
                    </p>

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
    <div className={`${style.container} ${isNotesOpen ? style.hiddenMobile : ""}`}>
      <div className={style.headerShell}>
        <div className={style.headerCard}>
          <p className={style.kicker}>Panel de notas</p>
          <h1 className={style.pageTitle}>
            {showList ? "Todas las Tareas" : "Mis Tareas de hoy"}
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

          <div className={style.lista}>
            {!showList ? (
              <button
                onClick={() => setShowList(true)}
                className={`${style.viewButton} ${style.viewButtonAlt}`}
              >
                Ver tareas en lista
              </button>
            ) : (
              <button
                onClick={() => setShowList(false)}
                className={style.viewButton}
              >
                Volver a la vista diaria
              </button>
            )}
          </div>
        </div>
      </div>

      <div
        className={style.tasksList}
        style={showList ? { margin: 0, width: "100%" } : {}}
      >
        {showList ? renderListTable() : renderContent()}
      </div>
    </div>
  );
}

export default Tareas;
