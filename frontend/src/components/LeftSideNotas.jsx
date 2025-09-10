import 'react-datepicker/dist/react-datepicker.css';
import style from '../style/LeftsideNotas.module.css';
import { useState, useEffect } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const initialFormData = {
  meta: '',
  fecha: new Date(),
  horario: '12:00',
  urgencia: 'importante',
  color: 'color1',
  esRecurrente: false,
};

function LeftSideNotas({ onTaskUpdate, taskToEdit }) {
  const [isOpen, setIsOpen] = useState(true);
  const toggleContainer = () => setIsOpen(!isOpen);
  
  const [formData, setFormData] = useState(initialFormData);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (taskToEdit) {
      setFormData({
        ...taskToEdit,
        fecha: new Date(taskToEdit.fecha),
      });
      setIsOpen(true);
    } else {
      setFormData(initialFormData);
    }
  }, [taskToEdit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };
  
  const handleDateChange = (date) => {
    setFormData(prevData => ({ ...prevData, fecha: date }));
  };

  const handleColorSelect = (colorName) => {
    setFormData(prevData => ({ ...prevData, color: colorName }));
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
      if (!token) { throw new Error('No estás autenticado.'); }

      // --- CORRECCIÓN DE ZONA HORARIA AQUÍ ---
      const fechaLocal = new Date(formData.fecha);
      fechaLocal.setMinutes(fechaLocal.getMinutes() - fechaLocal.getTimezoneOffset());
      const fechaFormateada = fechaLocal.toISOString().slice(0, 10); // "YYYY-MM-DD"

      const dataToSend = {
        ...formData,
        fecha: fechaFormateada,
      };
      // ------------------------------------

      if (taskToEdit) {
        // --- MODO EDICIÓN ---
        await axios.put(`${API_URL}/api/task/${taskToEdit._id}`, dataToSend, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSuccess('¡Tarea actualizada con éxito!');
      } else {
        // --- MODO CREACIÓN ---
        await axios.post(`${API_URL}/api/task`, dataToSend, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSuccess('¡Hábito/Tarea añadido con éxito!');
      }
      
      if (onTaskUpdate) onTaskUpdate();
      setTimeout(() => setSuccess(''), 3000);

    } catch (err) {
      setError(err.response?.data?.message || 'Hubo un error al guardar.');
    } finally {
      setLoading(false);
    }
  };

  const isEditing = !!taskToEdit;

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
            <p className={style.titleKeep}>{isEditing ? 'Editar Hábito' : 'Crea un habito'}</p>
          </div>
          <div className={style.containerForm}>
            <form onSubmit={handleSubmit}>
              <input name="meta" type="text" placeholder='Escriba su meta' value={formData.meta} onChange={handleChange} />
              <DatePicker selected={formData.fecha} onChange={handleDateChange} dateFormat="dd-MM-yyyy" className={style.datePicker} />
              <input name="horario" type="time" value={formData.horario} onChange={handleChange} className={style.datePicker} />
              <select name="urgencia" value={formData.urgencia} onChange={handleChange} className={style.select}>
                <option value="importante">Importante</option>
                <option value="urgente">Urgente</option>
                <option value="no importante">No Importante</option>
                <option value="obligaciones">Obligaciones</option>
              </select>
              <div>
                <p className={style.subtitle}>Seleccione un color para su tarea</p>
                <div className={style.containerColors}>
                   {['color1', 'color2', 'color3', 'color4'].map((color, index) => (
                      <div
                        key={color}
                        className={`${style[`circle${['One', 'Two', 'Three', 'Four'][index]}`]} ${formData.color === color ? style.selected : ''}`}
                        onClick={() => handleColorSelect(color)}
                      ></div>
                   ))}
                </div>
              </div>
              <div className={style.containerKeep}>
                <p className={style.keep}>Repetir diariamente</p>
                <input name="esRecurrente" type='checkbox' checked={formData.esRecurrente} onChange={handleChange} />
              </div>
              <div>
                <button className={style.btn} type="submit" disabled={loading}>
                  <p>{loading ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Añade un habito')}</p>
                </button>
                {isEditing && (
                  <button type="button" className={style.btnCancel} onClick={() => onTaskUpdate()}>
                    Cancelar
                  </button>
                )}
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