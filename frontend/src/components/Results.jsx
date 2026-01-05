import { useState, useMemo } from "react";
import axios from "axios";
import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import style from "../style/Results.module.css";
import { CiCalendarDate } from "react-icons/ci";
import { forwardRef } from "react";
import { PiListBulletsThin } from "react-icons/pi";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

function Results({
  token,
  onAuthSuccess,
  onLoginClick,
  onCloseModal,
  activeView,
  onEditClick,
  movimientos,
  onMovementUpdate,
  onShowAllChange,
}) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAll, setShowAll] = useState(false);

  // --- FILTRADO DE MOVIMIENTOS ---
  const filteredMovimientos = useMemo(() => {
    if (!Array.isArray(movimientos)) return [];

    if (showAll) return movimientos;

    const localSelectedDate = new Date(selectedDate);
    localSelectedDate.setMinutes(
      localSelectedDate.getMinutes() - localSelectedDate.getTimezoneOffset()
    );
    const formattedSelectedDate = localSelectedDate.toISOString().slice(0, 10);

    return movimientos.filter(
      (mov) => mov.fecha.slice(0, 10) === formattedSelectedDate
    );
  }, [movimientos, selectedDate, showAll]);

  // --- MANEJADORES ---
  const handleDateChange = (date) => {
    setSelectedDate(date);
    setShowAll(false); // volver a filtrar por fecha
    if (onShowAllChange) onShowAllChange(false);
  };

  const handleAllMovimientos = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/add/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data) {
        if (onMovementUpdate) onMovementUpdate(res.data);
        setShowAll(true);
        if (onShowAllChange) onShowAllChange(true);
      }
    } catch (err) {
      console.error("Error al obtener todos los movimientos:", err);
      alert("No se pudieron obtener los movimientos.");
    }
  };

  const handleDeleteMovimiento = async (movimientoId) => {
    if (
      !window.confirm("¿Estás seguro de que quieres eliminar este movimiento?")
    )
      return;
    try {
      await axios.delete(`${API_URL}/api/add/${movimientoId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (onMovementUpdate) onMovementUpdate();
    } catch (err) {
      console.error("Error al eliminar el movimiento:", err);
      alert("No se pudo eliminar el movimiento.");
    }
  };

  //componente de icono de calendario
  const CalendarButton = forwardRef(({ onClick }, ref) => (
    <button
      type="button"
      className={style.calendarButton}
      onClick={onClick}
      ref={ref}
    >
      <img src="./calendario.png" alt="calendario" />
    </button>
  ));

  // --- RENDER LOGIN / REGISTRO ---
  if (!token) {
    return (
      <div>
        {activeView === "login" ? (
          <LoginPage onClose={onCloseModal} onAuthSuccess={onAuthSuccess} />
        ) : (
          <SignupPage
            onSwitchToLogin={onLoginClick}
            onAuthSuccess={onAuthSuccess}
          />
        )}
      </div>
    );
  }

  // --- RENDER PRINCIPAL ---
  return (
    <div className={style.container}>
      <div className={style.header}>
        <div className={style.datePickerContainer}>
          <button className={style.icon}>
            <DatePicker
              selected={selectedDate}
              onChange={handleDateChange}
              dateFormat="dd-MM-yyyy"
              customInput={<CalendarButton />}
            />
            <p>Calendario</p>
          </button>

          <button
            onClick={() => {
              setShowAll(false);
              if (onShowAllChange) onShowAllChange(false);
            }}
            className={style.icon}
          >
            <img src="./hoy.png" alt="historial" />
            <p>Hoy</p>
          </button>

          <button onClick={handleAllMovimientos} className={style.icon}>
            <img src="./historial.png" alt="historial" />
            <p>Historial</p>
          </button>
        </div>
      </div>

      {/* --- CONTENEDOR DE MOVIMIENTOS --- */}
      {showAll ? (
        <div className={style.movimientosList}>
          {movimientos.map((mov) => (
            <div
              key={mov._id}
              className={`${style.movimientoRow} ${
                mov.tipo === "ingreso" ? style.bordeIngreso : style.bordeEgreso
              }`}
            >
              <div className={style.rowFecha}>
                {new Date(mov.fecha).toLocaleDateString()}
              </div>

              <div className={style.rowInfo}>
                <p className={style.category}>{mov.categoria}</p>
                <p className={style.detalle}>{mov.detalle}</p>
              </div>

              <div className={style.rowMonto}>
                {mov.tipo === "ingreso" ? "+" : "-"} ${mov.monto}
              </div>

              <div className={style.rowActions}>
                <button onClick={() => onEditClick(mov)}>
                  <img src="/edit.png" alt="edit" />
                </button>
                <button onClick={() => handleDeleteMovimiento(mov._id)}>
                  <img src="/trush.png" alt="delete" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={style.containerInfoAll}>
          {filteredMovimientos.length === 0 ? (
            <p style={{ textAlign: "center", marginTop: "2rem" }}>
              No tienes movimientos para esta fecha.
            </p>
          ) : (
            filteredMovimientos.map((mov) => (
              <div
                className={`${style.containerInfo} ${
                  mov.tipo === "ingreso"
                    ? style.bordeIngreso
                    : style.bordeEgreso
                }`}
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
                      <p
                        className={`${style.monto} ${
                          mov.tipo === "ingreso"
                            ? style.montoIngreso
                            : style.montoEgreso
                        }`}
                      >
                        {mov.tipo === "ingreso" ? "+" : "-"} ${mov.monto}
                      </p>
                      <div className={style.containerArrowDelete}>
                        <img
                          className={style.arrowResult}
                          src={
                            mov.tipo === "ingreso"
                              ? "/arrowGreen.png"
                              : "/arrowRed.png"
                          }
                          alt={mov.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                        />
                      </div>
                    </div>
                  </div>

                  {/* CARA TRASERA */}
                  <div className={style.cardBack}>
                    <p className={style.deletePromptText}>
                      ¿Desea eliminar o editar?
                    </p>
                    <div className={style.containerButton}>
                      <button
                        onClick={() => onEditClick(mov)}
                        className={style.deleteButton}
                      >
                        <img
                          className={style.ButtonImg}
                          src="/edit.png"
                          alt="edit"
                        />
                      </button>
                      <button
                        onClick={() => handleDeleteMovimiento(mov._id)}
                        className={style.deleteButton}
                      >
                        <img
                          className={style.ButtonImg}
                          src="/trush.png"
                          alt="delete"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default Results;
