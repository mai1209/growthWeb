import { useState, useMemo } from 'react';
import axios from 'axios';
import LoginPage from './LoginPage';
import SignupPage from './SignupPage';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import style from '../style/Results.module.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function Results({ token, onAuthSuccess, onLoginClick, onCloseModal, activeView, onEditClick, movimientos, onMovementUpdate }) {
  // --- HOOKS ---
  const [selectedDate, setSelectedDate] = useState(new Date());

  const filteredMovimientos = useMemo(() => {
    // Guarda de seguridad: si 'movimientos' no llega, devuelve una lista vacía.
    if (!Array.isArray(movimientos)) return [];

    // Formatea la fecha seleccionada para una comparación sin zona horaria
    const localSelectedDate = new Date(selectedDate);
    localSelectedDate.setMinutes(localSelectedDate.getMinutes() - localSelectedDate.getTimezoneOffset());
    const formattedSelectedDate = localSelectedDate.toISOString().slice(0, 10);

    return movimientos.filter(mov => {
      // Compara solo la parte 'YYYY-MM-DD' de las fechas
      return mov.fecha.slice(0, 10) === formattedSelectedDate;
    });
  }, [movimientos, selectedDate]);

  // --- MANEJADORES DE EVENTOS ---
  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  const handleDeleteMovimiento = async (movimientoId) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este movimiento?")) {
      return;
    }
    try {
      await axios.delete(`${API_URL}/api/add/${movimientoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Llama a la función del padre para refrescar la lista de datos
      if (onMovementUpdate) {
        onMovementUpdate();
      }
    } catch (err) {
      console.error("Error al eliminar el movimiento:", err);
      alert("No se pudo eliminar el movimiento.");
    }
  };

  // --- RENDERIZADO CONDICIONAL ---
  // Si no hay token, muestra la vista de Login/Registro
  if (!token) {
    return (
      <div>
        {activeView === 'login' ? (
          <LoginPage onClose={onCloseModal} onAuthSuccess={onAuthSuccess} />
        ) : (
          <SignupPage onSwitchToLogin={onLoginClick} onAuthSuccess={onAuthSuccess} />
        )}
      </div>
    );
  }

  // Si hay token, muestra la vista principal
  return (
    <div className={style.container}>
      <div className={style.header}>
        <h2>Movimientos del día</h2>
        <div className={style.datePickerContainer}>
          <DatePicker
            selected={selectedDate}
            onChange={handleDateChange}
            dateFormat="dd-MM-yyyy"
            className={style.datePicker}
          />
        </div>
      </div>

      <div className={style.containerInfoAll}>
        {filteredMovimientos.length === 0 ? (
          <p style={{ textAlign: 'center', marginTop: '2rem' }}>
            No tienes movimientos para esta fecha.
          </p>
        ) : (
          filteredMovimientos.map((mov) => (
            <div className={`${style.containerInfo} ${mov.tipo === 'ingreso' ? style.bordeIngreso : style.bordeEgreso}`} key={mov._id}>
              <div className={style.cardInner}>
                {/* CARA FRONTAL */}
                <div className={style.cardFront}>
                  <div className={style.info}>
                    <p className={style.category}>{mov.categoria}</p>
                    <p className={style.detalle}>{mov.detalle}</p>
                  </div>
                  <div className={style.montoContainer}>
                    <p className={`${style.monto} ${mov.tipo === 'ingreso' ? style.montoIngreso : style.montoEgreso}`}>
                      {mov.tipo === 'ingreso' ? '+' : '-'} ${mov.monto}
                    </p>
                    <div className={style.containerArrowDelete}>
                      <img
                        className={style.arrowResult}
                        src={mov.tipo === 'ingreso' ? '/arrowGreen.png' : '/arrowRed.png'}
                        alt={mov.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                      />

                    </div>
                  </div>
                </div>
                {/* CARA TRASERA */}
                <div className={style.cardBack}>
                  <p className={style.deletePromptText}>¿Desea eliminar?</p>
               <div className={style.containerButton}>
                   <button onClick={() => onEditClick(mov)} className={style.deleteButton}>
                    <img className={style.ButtonImg} src="/edit.png" alt="edit" />
                  </button>
                  <button
                    onClick={() => handleDeleteMovimiento(mov._id)}
                    className={style.deleteButton}
                  >
                    <img className={style.ButtonImg} src="/trush.png" alt="delete" />
                  </button>
               </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Results;