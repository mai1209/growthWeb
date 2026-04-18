import { forwardRef, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import style from "../style/Results.module.css";
import { movimientoService } from "../api";
import {
  filterMovimientosByCurrency,
  getMovementTypeMeta,
  formatSignedMoney,
  getCurrencyMeta,
} from "../utils/finance";

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

CalendarButton.displayName = "CalendarButton";

function Results({
  onEditClick,
  movimientos = [],
  onMovementUpdate,
  onShowAllChange,
  currentCurrency,
}) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAll, setShowAll] = useState(false);
  const [titulo, setTitulo] = useState("Movimientos de hoy");
  const [activeButton, setActiveButton] = useState("today");

  const currencyMeta = getCurrencyMeta(currentCurrency);

  const currencyMovimientos = useMemo(
    () => {
      if (showAll) {
        return filterMovimientosByCurrency(movimientos, currentCurrency, {
          to: new Date(),
        });
      }

      return filterMovimientosByCurrency(movimientos, currentCurrency, {
        from: selectedDate,
        to: selectedDate,
      });
    },
    [movimientos, currentCurrency, selectedDate, showAll]
  );

  const filteredMovimientos = useMemo(
    () =>
      [...currencyMovimientos].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      ),
    [currencyMovimientos]
  );

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setShowAll(false);
    setTitulo(`Movimientos del ${date.toLocaleDateString("es-AR")}`);
    setActiveButton("calendar");
    onShowAllChange?.(false);
  };

  const handleToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setShowAll(false);
    setTitulo("Movimientos de hoy");
    setActiveButton("today");
    onShowAllChange?.(false);
  };

  const handleAllMovimientos = () => {
    setShowAll(true);
    setTitulo("Historial completo");
    setActiveButton("all");
    onShowAllChange?.(true);
  };

  const handleDeleteMovimiento = async (id) => {
    if (!window.confirm("¿Eliminar movimiento?")) return;

    try {
      await movimientoService.delete(id);
      onMovementUpdate?.();
    } catch (error) {
      alert("No se pudo eliminar el movimiento");
    }
  };

  const formatFecha = (fechaISO) => {
    if (!fechaISO) return "";
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <section className={style.container}>
      <div className={style.header}>
        <div className={style.titleGroup}>
          <p className={style.eyebrow}>Historial filtrado</p>
          <h2>{titulo}</h2>
          <p>
            Mostrando solo movimientos guardados en {currencyMeta.label.toLowerCase()}.
          </p>
        </div>

        <div className={style.datePickerContainer}>
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
            <p>Fecha</p>
          </div>

          <button
            type="button"
            onClick={handleToday}
            className={`${style.icon} ${
              activeButton === "today" ? style.active : ""
            }`}
          >
            <img src="./hoy.png" alt="hoy" />
            <p>Hoy</p>
          </button>

          <button
            type="button"
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

      <div className={style.listShell}>
        {filteredMovimientos.length === 0 ? (
          <div className={style.emptyState}>
            <h3>No hay movimientos para mostrar</h3>
            <p>
              Cambia la fecha o la moneda del panel para revisar otra caja.
            </p>
          </div>
        ) : (
          <div className={style.listadoPrincipal}>
            {filteredMovimientos.map((movimiento) => (
              <article
                key={movimiento._id}
                className={`${style.movimientoRow} ${
                  movimiento.tipo === "ingreso"
                    ? style.bordeIngreso
                    : movimiento.tipo === "ahorro"
                      ? style.bordeAhorro
                      : style.bordeEgreso
                }`}
              >
                <div className={style.rowMain}>
                  <div className={style.rowTop}>
                    <div>
                      <p className={style.categoriaTexto}>{movimiento.categoria}</p>
                      <p className={style.detalleTexto}>
                        {movimiento.detalle || "Sin detalle"}
                      </p>
                    </div>

                    <div className={style.badges}>
                      {movimiento.esRecurrente && (
                        <span className={style.recurrenceBadge}>
                          Fijo {movimiento.frecuencia}
                        </span>
                      )}
                      <span className={style.currencyBadge}>
                        {currencyMeta.codeLabel}
                      </span>
                    </div>
                  </div>

                  <div className={style.rowBottom}>
                    <div className={style.metaBlock}>
                      <span>{formatFecha(movimiento.fecha)}</span>
                      <span className={style.typeLabel}>
                        {getMovementTypeMeta(movimiento.tipo).label}
                        {movimiento.isVirtualOccurrence ? " programado" : ""}
                      </span>
                      <strong
                        className={
                          movimiento.tipo === "ingreso"
                            ? style.montoIngreso
                            : movimiento.tipo === "ahorro"
                              ? style.montoAhorro
                              : style.montoEgreso
                        }
                      >
                        {formatSignedMoney(
                          movimiento.monto,
                          currentCurrency,
                          getMovementTypeMeta(movimiento.tipo).signedAsPositive
                        )}
                      </strong>
                    </div>

                    <div className={style.columna3}>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditClick(movimiento.sourceMovimiento || movimiento);
                        }}
                        className={style.btnAccion}
                        aria-label="Editar movimiento"
                      >
                        <img src="/edit.png" alt="edit" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteMovimiento(movimiento.sourceId || movimiento._id);
                        }}
                        className={style.btnAccion}
                        aria-label="Eliminar movimiento"
                      >
                        <img src="/trush.png" alt="delete" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default Results;
