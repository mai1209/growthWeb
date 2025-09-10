import axios from "axios";
import { useState, useEffect } from "react";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import style from '../style/Tarea.module.css';

// Mover la constante fuera del componente para optimizar
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function Tareas({ token, refreshKey, onEditClick }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    const fetchTasks = async () => {
      if (!token) { setTasks([]); return; }
      setLoading(true);
      setError('');
      try {
        const dateToFetch = new Date(selectedDate);
        dateToFetch.setMinutes(dateToFetch.getMinutes() - dateToFetch.getTimezoneOffset());
        const formattedDate = dateToFetch.toISOString().slice(0, 10);
        const res = await axios.get(`${API_URL}/api/task?fecha=${formattedDate}`, {
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

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  const renderContent = () => {
    if (loading) return <p>Cargando tareas...</p>;
    if (error) return <p style={{ color: 'red' }}>{error}</p>;
    if (tasks.length === 0) return <p>Aún no tienes tareas. ¡Añade una para comenzar!</p>;

    const handleToggleComplete = async (taskId, currentStatus) => {
      try {
        // NOTA: Asegúrate que esta ruta exista en tu backend para evitar conflictos
        const response = await axios.put(`${API_URL}/api/task/${taskId}/status`,
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
        await axios.delete(`${API_URL}/api/task/${taskId}`, {
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

  return (
    <div className={style.container}>
      <div className={style.header}>
        <h1>Mis Tareas</h1>
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