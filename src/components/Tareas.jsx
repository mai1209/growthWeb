import axios from "axios";
import { useState, useEffect } from "react";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import style from '../style/Tarea.module.css';

function Tareas({ token, refreshKey }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // CORRECCIÓN 1: El estado inicial debe ser un objeto Date
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    const fetchTasks = async () => {
      if (!token) {
        setTasks([]);
        return;
      }
      setLoading(true);
      setError('');
      try {
        // CORRECCIÓN 2: Formatear la fecha antes de enviarla a la API
        const dateToFetch = new Date(selectedDate);
        dateToFetch.setMinutes(dateToFetch.getMinutes() - dateToFetch.getTimezoneOffset());
        const formattedDate = dateToFetch.toISOString().slice(0, 10);

        const res = await axios.get(`http://localhost:3000/api/task?fecha=${formattedDate}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTasks(res.data);
      } catch (err) {
        console.error("Error al obtener las tareas:", err);
        setError("No se pudieron cargar las tareas para esta fecha.");
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [token, refreshKey, selectedDate]);

  // CORRECCIÓN 3: La función debe recibir 'date' directamente
  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  const renderContent = () => {
    if (loading) return <p>Cargando tareas...</p>;
    if (error) return <p style={{ color: 'red' }}>{error}</p>;
    if (tasks.length === 0) return <p>Aún no tienes tareas. ¡Añade una para comenzar!</p>;

    const handleToggleComplete = async (taskId, currentStatus) => {
      try {
        const response = await axios.put(`http://localhost:3000/api/task/${taskId}`,
          { completada: !currentStatus },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setTasks(prevTasks =>
          prevTasks.map(task =>
            task._id === taskId ? response.data : task
          )
        );
      } catch (err) {
        console.error("Error al actualizar la tarea:", err);
      }
    };

    const handleDeleteTask = async (taskId) => {
      if (!window.confirm("¿Estás seguro de que quieres eliminar esta tarea?")) return;
      try {
        await axios.delete(`http://localhost:3000/api/task/${taskId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setTasks(prevTasks => prevTasks.filter(task => task._id !== taskId));
      } catch (err) {
        console.error("Error al eliminar la tarea:", err);
      }
    };

    return tasks.map((task) => (
      <div className={style.taskContainer} key={task._id}>
        <div className={`${style.taskCard} ${task.completada ? style.completed : ''} ${style[task.color] || style.color1}`}>
          <div className={style.taskHeader}>
            <p className={style.taskMeta}>{task.meta}</p>
            <p className={style.taskUrgency}>Urgencia &gt; {task.urgencia}</p>
          </div>
          <div className={style.taskDetails}>
            <p>Horario: {task.horario || 'Sin horario'}</p>
          </div>
          <div className={style.taskActions}>
            <p className={task.completada ? style.statusDone : style.statusPending}>
              {task.completada ? 'Hecho' : 'Pendiente'}
            </p>
            <input
              type="checkbox"
              checked={task.completada}
              onChange={() => handleToggleComplete(task._id, task.completada)}
            />
            <button
              onClick={() => handleDeleteTask(task._id)}
              className={style.deleteButton}
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    ));
  };

  return (
    <div className={style.container}>
      <div className={style.header}>
        <h1>Mis Tareas</h1>
        {/* CORRECCIÓN 4: Usar 'selected' y el formato correcto */}
        <DatePicker
          selected={selectedDate}
          onChange={handleDateChange}
          dateFormat="dd-MM-yyyy"
          className={style.datePicker}
        />
      </div>
      <div className={style.tasksList}>
        {renderContent()}
      </div>
    </div>
  );
}

export default Tareas;