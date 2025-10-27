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
  const [showAll, setShowAll] = useState(false);

  // --- FILTRADO DE MOVIMIENTOS ---
  const filteredMovimientos = useMemo(() => {
    if (!Array.isArray(movimientos)) return [];

    if (showAll) return movimientos;

    const localSelectedDate = new Date(selectedDate);
    localSelectedDate.setMinutes(localSelectedDate.getMinutes() - localSelectedDate.getTimezoneOffset());
    const formattedSelectedDate = localSelectedDate.toISOString().slice(0, 10);

    return movimientos.filter(mov => mov.fecha.slice(0, 10) === formattedSelectedDate);
  }, [movimientos, selectedDate, showAll]);

  // --- MANEJADORES DE EVENTOS ---
  const handleDateChange = (date) => {
    setSelectedDate(date);
    setShowAll(false); // volver a filtrar por fecha si cambian la fecha
  };

  const handleDeleteMovimiento = async (movimientoId) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este movimiento?")) return;

    try {
      await axios.delete(`${API_URL}/api/add/${movimientoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (onMovementUpdate) onMovementUpdate();
    } catch (err) {
      console.error("Error al eliminar el movimiento:", err);
      alert("No se pudo eliminar el movimiento.");
    }
  };

  const handleAllMovimientos = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/add/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data) {
        if (onMovementUpdate) onMovementUpdate(res.data);
        setShowAll(true); // mostrar todos los movimientos
      }
    } catch (err) {
      console.error("Error al obtener todos los movimientos:", err);
      alert("No se pudieron obtener los movimientos.");
    }
  };

  // --- RENDERIZADO CONDICIONAL ---
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

  // --- RENDER PRINCIPAL ---
  return (
    <div className={style.container}>
      <div className={style.header}>
        <h2>Movimientos</h2>
        <div className={style.datePickerContainer}>
          <DatePicker
            selected={selectedDate}
            onChange={handleDateChange}
            dateFormat="dd-MM-yyyy"
            className={style.datePicker}
          />
          <button onClick={handleAllMovimientos} className={style.datePicker}>
            Ver todos los movimientos
          </button>
        </div>
      </div>

      <div className={style.containerInfoAll}>
        {filteredMovimientos.length === 0 ? (
          <p style={{ textAlign: 'center', marginTop: '2rem' }}>
            No tienes movimientos para esta fecha.
          </p>
        ) : (
          filteredMovimientos.map((mov) => (
            <div
              className={`${style.containerInfo} ${mov.tipo === 'ingreso' ? style.bordeIngreso : style.bordeEgreso}`}
              key={mov._id}
            >
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
                  <p className={style.deletePromptText}>¿Desea eliminar o editar?</p>
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
