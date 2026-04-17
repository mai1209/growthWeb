import { useState, useEffect } from "react";
import { taskService } from "../api"; // Importamos el servicio
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import style from "../style/Tarea.module.css";
import resultsStyle from "../style/Results.module.css";
import { useOutletContext } from "react-router-dom";

function Tareas({  refreshKey, onEditClick }) {
  const { isNotesOpen } = useOutletContext();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(false);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    let isMounted = true;

    const fetchTasks = async () => {
      const storedToken = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!storedToken) return;


      setLoading(true);
      try {
        let res;
        if (showList) {
          res = await taskService.getAll(); 
        } else {
        const formattedDate = selectedDate.toLocaleDateString('sv-SE');
          res = await taskService.getByDate( formattedDate); 
        }
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
  }, [ refreshKey, selectedDate, showList]);

  const handleToggleComplete = async (taskId) => {
    try {
      const date = new Date(selectedDate);
      date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
      const fecha = date.toISOString().slice(0, 10);

      const res = await taskService.updateStatus( taskId, { fecha });
      setTasks((prev) => prev.map((t) => (t._id === taskId ? res.data : t)));
    } catch (err) {
      console.error("Error al actualizar estado");
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("¿Eliminar tarea?")) return;
    try {
      await taskService.delete( taskId);
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
    } catch (err) {
      console.error("Error al eliminar");
    }
  };

  const renderContent = () => {
    if (loading) return <p className={style.emptyMessage}>Cargando tareas...</p>;
    if (error) return <p className={style.errorMessage}>{error}</p>;
    if (tasks.length === 0)
      return (
        <p className={style.emptyMessage}>
          Aun no tienes tareas. Anade una para comenzar.
        </p>
      );

    return tasks.map((task) => (
      <div className={style.taskContainer} key={task._id}>
        <div
          className={`${style.taskCard} ${
            task.completada ? style.completed : ""
          } ${style[task.color] || style.color1}`}
        >
          <label className={style.checkboxWrapper}>
            <input
              type="checkbox"
              checked={task.completada}
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
            <p className={style.taskUrgency}> {task.urgencia}</p>
          </div>

          <div className={style.taskDetails}>
            <p>{task.horario || "Sin horario"} </p>
          </div>

          <div className={style.taskActions}>
            <button
              onClick={() => onEditClick(task)}
              className={style.editButton}
            >
              <img className={style.ButtonImg} src="/edit.png" alt="edit" />
            </button>

            <button
              onClick={() => handleDeleteTask(task._id)}
              className={style.deleteButton}
            >
              <img className={style.ButtonImg} src="/trush.png" alt="delete" />
            </button>
          </div>
        </div>
      </div>
    ));
  };

  const renderListTable = () => {
    if (loading) return <p className={style.emptyMessage}>Cargando tareas...</p>;
    if (error) return <p className={style.errorMessage}>{error}</p>;
    if (!tasks || tasks.length === 0)
      return <p className={style.emptyMessage}>No hay tareas para esta fecha.</p>;

    return (
      <div className={style.taskListMode}>
        {tasks.map((t) => (
          <div key={t._id} className={style.listRow}>
            <div>
              <p className={style.listTitle}>{t.meta}</p>
              <p className={style.listMeta}>
                {t.urgencia} ·{" "}
                <span className={style.listState}>
                  {t.completada ? "Hecho" : "Pendiente"}
                </span>
              </p>
            </div>

            <p className={style.listSchedule}>
              {t.fecha ? t.fecha.slice(0, 10) : "-"} · {t.horario || "--:--"}
            </p>

            <div className={style.listActions}>
              <button onClick={() => onEditClick(t)}>Editar</button>
              <button onClick={() => handleDeleteTask(t._id)}>Eliminar</button>
            </div>
          </div>
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
          <p className={style.pageText}>
            Mantiene el mismo estilo del dashboard y te deja alternar entre vista
            diaria y lista completa.
          </p>

          <div className={style.containerFecha}>
            <p>Tareas de</p>
            {!showList && (
              <DatePicker
                selected={selectedDate}
                onChange={handleDateChange}
                dateFormat="dd-MM-yyyy"
                className={resultsStyle.datePicker}
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
