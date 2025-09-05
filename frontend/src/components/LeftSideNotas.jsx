import 'react-datepicker/dist/react-datepicker.css';
import style from '../style/LeftsideNotas.module.css';
import { useState } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';

function LeftSideNotas({ onTaskAdded }) {
  const [isOpen, setIsOpen] = useState(true);
  const toggleContainer = () => setIsOpen(!isOpen);

  const initialFormData = {
    meta: '',
    fecha: new Date(),
    horario: '12:00',
    urgencia: 'importante',
    color: 'color1',
    esRecurrente: false,
  };
  
  const [formData, setFormData] = useState(initialFormData);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };
  
  const handleDateChange = (date) => {
    setFormData(prevData => ({
      ...prevData,
      fecha: date,
    }));
  };


const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!formData.meta) {
      setError('Por favor, escribe el nombre de la meta.');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No estás autenticado. Por favor, inicia sesión.');
        setLoading(false);
        return;
      }

      // --- 👇 LA SOLUCIÓN ESTÁ AQUÍ 👇 ---

      // 1. Creamos una copia de la fecha para no modificar el estado directamente
      const fechaLocal = new Date(formData.fecha);
      
      // 2. Ajustamos la fecha por la zona horaria para que ISOString nos dé el día correcto
      fechaLocal.setMinutes(fechaLocal.getMinutes() - fechaLocal.getTimezoneOffset());
      
      // 3. Creamos un nuevo objeto de datos para enviar, con la fecha ya formateada
      const dataToSend = {
        ...formData,
        fecha: fechaLocal.toISOString().slice(0, 10), // Formato "YYYY-MM-DD"
      };

      // 4. Enviamos 'dataToSend' en lugar de 'formData'
      await axios.post(`${API_URL}/api/task`, dataToSend, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setSuccess('¡Hábito/Tarea añadido con éxito!');
      setFormData(initialFormData); 
      
      if (onTaskAdded) {
        onTaskAdded();
      }
      setTimeout(() => setSuccess(''), 3000);

    } catch (err) {
      setError(err.response?.data?.message || 'Hubo un error al guardar.');
    } finally {
      setLoading(false);
    }
  };

  const handleColorSelect = (colorName) => {
    setFormData(prevData => ({
      ...prevData,
      color: colorName,
    }));
  };

  return (
    <div className={`${style.container} ${!isOpen ? style.closed : ''}`}>
      <div className={style.containerOpenClose}>
        <img
          className={style.close}
          src={isOpen ? "/close.png" : "/open.png"}
          alt={isOpen ? "close-tab" : "open-tab"}
          onClick={toggleContainer}
        />
      </div>

      {isOpen && (
        <>
          <div className={style.containerInfo}>
            <p className={style.titleKeep}>Crea un habito</p>
          </div>
          <div className={style.containerForm}>
            <form onSubmit={handleSubmit}>
              <input
                name="meta"
                type="text"
                placeholder='Escriba su meta'
                value={formData.meta}
                onChange={handleChange}
              />

              <DatePicker
                selected={formData.fecha}
                onChange={handleDateChange}
                dateFormat="dd-MM-yyyy"
                className={style.datePicker}
              />

              <input
                name="horario"
                type="time"
                value={formData.horario}
                onChange={handleChange}
                className={style.datePicker}
              />
              <select
                name="urgencia"
                value={formData.urgencia}
                onChange={handleChange}
                className={style.select}
              >
                <option value="importante">Importante</option>
                <option value="urgente">Urgente</option>
                <option value="no importante">No Importante</option>
                <option value="obligaciones">Obligaciones</option>
              </select>

              <div>
                <p className={style.subtitle}>Seleccione un color para su tarea</p>
                <div className={style.containerColors}>
                   <div
                    className={`${style.circleOne} ${formData.color === 'color1' ? style.selected : ''}`}
                    onClick={() => handleColorSelect('color1')}
                  ></div>
                  <div
                    className={`${style.circleTwo} ${formData.color === 'color2' ? style.selected : ''}`}
                    onClick={() => handleColorSelect('color2')}
                  ></div>
                  <div
                    className={`${style.circleThree} ${formData.color === 'color3' ? style.selected : ''}`}
                    onClick={() => handleColorSelect('color3')}
                  ></div>
                  <div
                    className={`${style.circleFour} ${formData.color === 'color4' ? style.selected : ''}`}
                    onClick={() => handleColorSelect('color4')}
                  ></div>
                </div>
              </div>
              
              <div className={style.containerKeep}>
                <p className={style.keep}>Repetir diariamente</p>
                <input
                  name="esRecurrente"
                  type='checkbox'
                  checked={formData.esRecurrente}
                  onChange={handleChange}
                />
              </div>
              
              <div>
                <button className={style.btn} type="submit" disabled={loading}>
                  <p>{loading ? 'Guardando...' : 'Añade un habito'}</p>
                </button>
              </div>
            </form>

            {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
            {success && <p style={{ color: 'green', marginTop: '10px' }}>{success}</p>}
          </div>
        </>
      )}
    </div>
  );
}

export default LeftSideNotas;