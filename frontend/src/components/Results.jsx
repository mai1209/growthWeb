import { useState, useMemo, forwardRef } from "react";
import axios from "axios";
import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import style from "../style/Results.module.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

// 📅 Botón calendario custom
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
  // ---------------- ESTADOS ----------------
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAll, setShowAll] = useState(false);
  const [titulo, setTitulo] = useState("Movimientos de Hoy");
  const [activeButton, setActiveButton] = useState("today"); // 👈 clave

  // ---------------- FILTRADO ----------------
  const filteredMovimientos = useMemo(() => {
    if (!Array.isArray(movimientos)) return [];

    if (showAll) return movimientos;

    const localDate = new Date(selectedDate);
    localDate.setMinutes(
      localDate.getMinutes() - localDate.getTimezoneOffset()
    );
    const formatted = localDate.toISOString().slice(0, 10);

    return movimientos.filter((mov) => mov.fecha.slice(0, 10) === formatted);
  }, [movimientos, selectedDate, showAll]);

  const listaFinal = showAll ? movimientos : filteredMovimientos;

  // ---------------- HANDLERS ----------------
  const handleDateChange = (date) => {
    setSelectedDate(date);
    setShowAll(false);
    setTitulo(`Movimientos del día ${date.toLocaleDateString("es-AR")}`);
    setActiveButton("calendar");
    onShowAllChange?.(false);
  };

  const handleToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setShowAll(false);
    setTitulo("Movimientos de Hoy");
    setActiveButton("today");
    onShowAllChange?.(false);
  };

 const handleAllMovimientos = () => {
  setShowAll(true);
  setTitulo("Todos los Movimientos");
  setActiveButton("all");
  onShowAllChange?.(true);
};


  const handleDeleteMovimiento = async (id) => {
    if (!window.confirm("¿Eliminar movimiento?")) return;

    try {
      await axios.delete(`${API_URL}/api/add/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onMovementUpdate?.();
    } catch (err) {
      console.error(err);
    }
  };
const formatMonto = (monto) => {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(monto);
};

  // ---------------- LOGIN / SIGNUP ----------------
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

  // ---------------- UTIL ----------------
  const formatFecha = (fechaISO) => {
    if (!fechaISO) return "";
    const f = new Date(fechaISO);
    return `${f.getDate()}/${f
      .toLocaleDateString("es-AR", { month: "long" })
      .replace(/^./, (l) => l.toUpperCase())}/${f.getFullYear()}`;
  };

  // ---------------- RENDER ----------------
  return (
    <div className={style.container}>
      {/* HEADER */}
      <div className={style.header}>
        <div className={style.datePickerContainer}>
          {/* CALENDARIO */}
          <div
            className={`${style.icon} ${
              activeButton === "calendar" ? style.active : ""
            }`}
          >
            <DatePicker
              selected={selectedDate}
              onChange={handleDateChange}
              dateFormat="dd-MM-yyyy"
              customInput={<CalendarButton />}
              popperPortalId="root"
              popperPlacement="bottom-start"
            />
            <p>Calendario</p>
          </div>

          {/* HOY */}
          <button
            onClick={handleToday}
            className={`${style.icon} ${
              activeButton === "today" ? style.active : ""
            }`}
          >
            <img src="./hoy.png" alt="hoy" />
            <p>Hoy</p>
          </button>

          {/* HISTORIAL */}
          <button
            onClick={handleAllMovimientos}
            className={`${style.icon} ${
              activeButton === "all" ? style.active : ""
            }`}
          >
            <img src="./historial.png" alt="historial" />
            <p>Historial</p>
          </button>
        </div>
      </div>

      {/* TITULO */}
      <div className={style.titulocontainer}>
        <p className={style.titulo}>{titulo}</p>
      </div>

      <div className={style.containerAllPublicidadResults}>
        <div className={style.containerImg}>
          <img className={style.publicidad} src="./publicidad.jpg" alt="publicidad" />
        </div>
        {/* LISTADO */}
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
                  mov.tipo === "ingreso"
                    ? style.bordeIngreso
                    : style.bordeEgreso
                }`}
              >
                <div className={style.columna1}>
                  <p className={style.categoriaTexto}>{mov.categoria}</p>
                  <p className={style.fechaTexto}>{formatFecha(mov.fecha)}</p>
                </div>

                <div className={style.columnados}>
                  <div className={style.columna2}>
                    <p
                      className={`${style.montoTexto} ${
                        mov.tipo === "ingreso"
                          ? style.montoIngreso
                          : style.montoEgreso
                      }`}
                    >
                      {mov.tipo === "ingreso" ? "+" : "-"} ${formatMonto(mov.monto)}
                    </p>
                    <p className={style.detalleTexto}>
                      {mov.detalle || "sin detalle"}
                    </p>
                  </div>

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
        <div className={style.containerImg}>
          <img className={style.publicidad} src="./publicidad.jpg" alt="publicidad" />
        </div>
      </div>
    </div>
  );
}

export default Results;
