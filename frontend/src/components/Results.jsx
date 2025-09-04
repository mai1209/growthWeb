import { useEffect, useState } from 'react';
import axios from 'axios';
import LoginPage from './LoginPage';
import SignupPage from './SignupPage';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import style from '../style/Results.module.css';



function Results({ token, onAuthSuccess, onLoginClick, onCloseModal, activeView, refreshKey }) {
  const [movimientos, setMovimientos] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    const fetchMovimientos = async () => {
      if (!token) {
        setMovimientos([]);
        return;
      }
      try {
        // --- CAMBIO 2: Formateamos la fecha a texto ANTES de enviarla a la API ---
        // Ajustamos la zona horaria para evitar problemas de un día antes/después
        const dateToFetch = new Date(selectedDate);
        dateToFetch.setMinutes(dateToFetch.getMinutes() - dateToFetch.getTimezoneOffset());
        const formattedDate = dateToFetch.toISOString().slice(0, 10); // "YYYY-MM-DD"

        const res = await axios.get(`http://localhost:3000/api/add?fecha=${formattedDate}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMovimientos(res.data);
      } catch (err) {
        console.error("Error al obtener movimientos:", err);
        setMovimientos([]);
      }
    };
    fetchMovimientos();
  }, [token, refreshKey, selectedDate]);

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  const handleDeleteMovimiento = async (movimientoId) => {

    if (!window.confirm("¿Estás seguro de que quieres eliminar este movimiento?")) {
      return;
    }
    try {
      await axios.delete(`http://localhost:3000/api/add/${movimientoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMovimientos(prevMovimientos => prevMovimientos.filter(mov => mov._id !== movimientoId));
    } catch (err) {
      console.error("Error al eliminar el movimiento:", err);
      alert("No se pudo eliminar el movimiento.");
    }
  };


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
        {movimientos.length === 0 ? (
          <p style={{ textAlign: 'center', marginTop: '2rem' }}>
            No tienes movimientos para esta fecha. ¡Añade uno para comenzar!
          </p>
        ) : (
          movimientos.map((mov) => (
          
            <div className={`${style.containerInfo} ${mov.tipo === 'ingreso' ? style.bordeIngreso : style.bordeEgreso}`} key={mov._id}>

              <div className={style.cardInner}>

                {/* CARA FRONTAL: Contiene TUS estilos y estructura original */}
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

                {/* CARA TRASERA: Contiene solo el botón de borrar */}
                <div className={style.cardBack}>
                  <p className={style.deletePromptText}>¿Desea eliminar este movimiento?</p>
                  <button
                    onClick={() => handleDeleteMovimiento(mov._id)}
                    className={style.deleteButton}
                  >
                    🗑️
                  </button>
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