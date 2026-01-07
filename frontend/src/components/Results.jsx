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
  const [titulo, setTitulo] = useState("Hoy");

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
    setShowAll(false);
    setTitulo(`Movimientos del día ${date.toLocaleDateString("es-AR")}`);
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
        setTitulo("Todos los Movimientos");
        if (onShowAllChange) onShowAllChange(true);
      }
    } catch (err) {
      console.error(err);
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

  //funcion de hoy
  const handleToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setShowAll(false);
    setTitulo("Movimientos de Hoy");
    if (onShowAllChange) onShowAllChange(false);
  };

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

  //funcion de fecha

  const formatFecha = (fechaISO) => {
    if (!fechaISO) return "";

    const fecha = new Date(fechaISO);

    const dia = fecha.getDate();
    const mes = fecha
      .toLocaleDateString("es-AR", { month: "long" })
      .replace(/^./, (l) => l.toUpperCase());
    const anio = fecha.getFullYear();

    return `${dia}/${mes}/${anio}`;
  };

  const listaFinal = showAll ? movimientos : filteredMovimientos;
  // --- RENDER PRINCIPAL ---
  return (
    <div className={style.container}>
      {/* HEADER (Se queda igual como pediste) */}
      <div className={style.header}>
        <div className={style.datePickerContainer}>
          <button className={style.icon}>
            <DatePicker
              selected={selectedDate}
              onChange={handleDateChange}
              dateFormat="dd-MM-yyyy"
              customInput={<CalendarButton />}
              popperPortalId="root"
              popperPlacement="bottom-start"
            />
            <p>Calendario</p>
          </button>

          <button onClick={handleToday} className={style.icon}>
            <img src="./hoy.png" alt="historial" />
            <p>Hoy</p>
          </button>

          <button onClick={handleAllMovimientos} className={style.icon}>
            <img src="./historial.png" alt="historial" />
            <p>Historial</p>
          </button>
        </div>
      </div>
      <p className={style.titulo}>{titulo}</p>

      {/* 2. RENDER UNIFICADO (Sin repetir código) */}
      <div className={style.listadoPrincipal}>
        {listaFinal.length === 0 ? (
          <p style={{ textAlign: "center", marginTop: "2rem" }}>
            No hay movimientos para mostrar.
          </p>
        ) : (
          listaFinal.map((mov) => (
            <div
              key={mov._id}
              className={`${style.movimientoRow} ${
                mov.tipo === "ingreso" ? style.bordeIngreso : style.bordeEgreso
              }`}
            >
              {/* COLUMNA 1: INFO */}
              <div className={style.columna1}>
                <p className={style.categoriaTexto}>{mov.categoria}</p>
                <p className={style.fechaTexto}>{formatFecha(mov.fecha)}</p>
              </div>
              <div className={style.columnados}>
                {/* COLUMNA 2: MONTO Y DETALLE */}
                <div className={style.columna2}>
                  <p
                    className={`${style.montoTexto} ${
                      mov.tipo === "ingreso"
                        ? style.montoIngreso
                        : style.montoEgreso
                    }`}
                  >
                    {mov.tipo === "ingreso" ? "+" : "-"} ${mov.monto}
                  </p>
                  <p className={style.detalleTexto}>
                    {mov.detalle === "" ? "sin detalle" : mov.detalle}
                  </p>
                </div>

                {/* COLUMNA 3: ACCIONES */}
                <div className={style.columna3}>
                  <button
                    onClick={() => onEditClick(mov)}
                    className={style.btnAccion}
                  >
                    <img src="/edit.png" alt="edit" />
                  </button>
                  <button
                    onClick={() => handleDeleteMovimiento(mov._id)}
                    className={style.btnAccion}
                  >
                    <img src="/trush.png" alt="delete" />
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
