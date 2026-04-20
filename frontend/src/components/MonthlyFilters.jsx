import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import style from "../style/MonthlyFilters.module.css";
import { movimientoService } from "../api";
import {
  CURRENCY_OPTIONS,
  MOVEMENT_METHOD_OPTIONS,
  MOVEMENT_TYPE_OPTIONS,
  filterMovimientosByCurrency,
  getDebtStatusMeta,
  formatMoney,
  formatSignedMoney,
  getCurrencyMeta,
  getMovementMethodMeta,
  getMovementTypeMeta,
  summarizeByType,
} from "../utils/finance";

const RECURRENCE_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "manual", label: "Manual" },
  { value: "fixed", label: "Fijos" },
];

const TYPE_FILTERS = [{ value: "all", label: "Todos" }, ...MOVEMENT_TYPE_OPTIONS];
const METHOD_FILTERS = [{ value: "all", label: "Todos" }, ...MOVEMENT_METHOD_OPTIONS];

const getMonthInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getDayInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDateFromInputValue = (value) => {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date();
  }

  return new Date(year, month - 1, day);
};

const getMonthRange = (monthValue) => {
  const [year, month] = monthValue.split("-").map(Number);

  if (!year || !month) {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  }

  return {
    from: new Date(year, month - 1, 1),
    to: new Date(year, month, 0),
  };
};

const formatDate = (value) => {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function MonthlyFilters({
  movimientos = [],
  currentCurrency,
  onCurrencyChange,
  onMovementUpdate,
  onEditMovement,
}) {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(getMonthInputValue(new Date()));
  const [selectedDay, setSelectedDay] = useState(getDayInputValue(new Date()));
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedRecurrence, setSelectedRecurrence] = useState("all");
  const [selectedMethod, setSelectedMethod] = useState("all");
  const [settleMovementId, setSettleMovementId] = useState(null);
  const [settleDate, setSettleDate] = useState(getDayInputValue(new Date()));
  const [settleMethod, setSettleMethod] = useState("efectivo");
  const [settleDetail, setSettleDetail] = useState("");
  const [settlingId, setSettlingId] = useState(null);

  const { from, to } = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
  const selectedDayDate = useMemo(
    () => getDateFromInputValue(selectedDay),
    [selectedDay]
  );
  const currencyMeta = getCurrencyMeta(currentCurrency);

  const monthMovimientos = useMemo(
    () =>
      filterMovimientosByCurrency(movimientos, currentCurrency, {
        from,
        to,
      }),
    [movimientos, currentCurrency, from, to]
  );

  const filteredMovimientos = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return [...monthMovimientos]
      .filter((movimiento) => {
        if (selectedType !== "all" && movimiento.tipo !== selectedType) {
          return false;
        }

        if (selectedRecurrence === "fixed" && !movimiento.esRecurrente) {
          return false;
        }

        if (selectedRecurrence === "manual" && movimiento.esRecurrente) {
          return false;
        }

        if (selectedMethod !== "all") {
          if (movimiento.tipo === "deuda" && movimiento.deudaEstado !== "pagada") {
            return false;
          }

          if (movimiento.medio !== selectedMethod) {
            return false;
          }
        }

        if (!normalizedSearch) {
          return true;
        }

        const haystack = [
          movimiento.categoria,
          movimiento.detalle,
          movimiento.deudaAcreedor,
          movimiento.deudaEstado,
          getMovementTypeMeta(movimiento.tipo).label,
          movimiento.tipo === "deuda" && movimiento.deudaEstado !== "pagada"
            ? ""
            : getMovementMethodMeta(movimiento.medio).label,
          movimiento.frecuencia,
          formatDate(movimiento.fecha),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [monthMovimientos, searchTerm, selectedType, selectedRecurrence, selectedMethod]);

  const filteredSummary = useMemo(
    () => summarizeByType(filteredMovimientos),
    [filteredMovimientos]
  );
  const dayMovimientos = useMemo(
    () =>
      filterMovimientosByCurrency(movimientos, currentCurrency, {
        from: selectedDayDate,
        to: selectedDayDate,
      })
        .filter((movimiento) =>
          selectedType === "all" ? true : movimiento.tipo === selectedType
        )
        .filter((movimiento) =>
          selectedMethod === "all"
            ? true
            : movimiento.tipo === "deuda" && movimiento.deudaEstado !== "pagada"
              ? false
              : movimiento.medio === selectedMethod
        )
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    [movimientos, currentCurrency, selectedDayDate, selectedMethod, selectedType]
  );

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedType("all");
    setSelectedRecurrence("all");
    setSelectedMethod("all");
  };

  const handleEditMovimiento = (movimiento) => {
    const baseMovimiento = movimiento.sourceMovimiento || movimiento;
    onEditMovement?.(baseMovimiento);
    navigate("/add");
  };

  const handleDeleteMovimiento = async (movimiento) => {
    const movementId = movimiento.sourceId || movimiento._id;

    if (!movementId || !window.confirm("¿Eliminar movimiento?")) return;

    try {
      await movimientoService.delete(movementId);
      onMovementUpdate?.();
    } catch (error) {
      alert("No se pudo eliminar el movimiento");
    }
  };

  const handleStartSettleDebt = (movimiento) => {
    const movementId = movimiento.sourceId || movimiento._id;
    setSettleMovementId(movementId);
    setSettleDate(getDayInputValue(new Date()));
    setSettleMethod("efectivo");
    setSettleDetail(
      movimiento.deudaAcreedor
        ? `Pago de deuda a ${movimiento.deudaAcreedor}`
        : "Pago de deuda"
    );
  };

  const handleConfirmSettleDebt = async (movimiento) => {
    const movementId = movimiento.sourceId || movimiento._id;

    if (!movementId) return;

    try {
      setSettlingId(movementId);
      await movimientoService.settleDebt(movementId, {
        fecha: settleDate,
        medio: settleMethod,
        detalle: settleDetail.trim(),
      });
      setSettleMovementId(null);
      setSettleDetail("");
      onMovementUpdate?.();
    } catch (error) {
      alert(error.response?.data?.error || "No se pudo marcar la deuda como pagada");
    } finally {
      setSettlingId(null);
    }
  };

  const renderMovementRow = (movimiento) => {
    const typeMeta = getMovementTypeMeta(movimiento.tipo);
    const methodMeta = getMovementMethodMeta(movimiento.medio);
    const debtStatusMeta = getDebtStatusMeta(movimiento.deudaEstado);
    const isDebt = movimiento.tipo === "deuda";
    const isPendingDebt = isDebt && movimiento.deudaEstado !== "pagada";
    const toneClass =
      movimiento.tipo === "ingreso"
        ? style.incomeRow
        : movimiento.tipo === "ahorro"
          ? style.savingsRow
          : isDebt
            ? style.debtRow
            : style.expenseRow;
    const movementId = movimiento.sourceId || movimiento._id;
    const isSettlingThis = settleMovementId === movementId;
    const amountLabel =
      typeMeta.signedAsPositive === null
        ? formatMoney(movimiento.monto, currentCurrency)
        : formatSignedMoney(
            movimiento.monto,
            currentCurrency,
            typeMeta.signedAsPositive
          );

    return (
      <article key={movimiento._id} className={`${style.row} ${toneClass}`}>
        <div className={style.rowMain}>
          <div>
            <p className={style.rowCategory}>{movimiento.categoria}</p>
            <p className={style.rowDetail}>
              {movimiento.detalle || "Sin detalle"}
            </p>
            {isDebt && movimiento.deudaAcreedor ? (
              <p className={style.rowExtra}>Acreedor: {movimiento.deudaAcreedor}</p>
            ) : null}
          </div>

          <div className={style.rowBadges}>
            <span className={style.badge}>{typeMeta.label}</span>
            {isDebt ? (
              <span
                className={
                  debtStatusMeta.tone === "paid"
                    ? style.badgeNeutral
                    : style.badgeWarning
                }
              >
                {debtStatusMeta.label}
              </span>
            ) : null}
            {!isPendingDebt ? (
              <span className={style.badge}>{methodMeta.label}</span>
            ) : null}
            <span className={style.badge}>{currencyMeta.codeLabel}</span>
            {movimiento.esRecurrente ? (
              <span className={style.badgeAccent}>Fijo {movimiento.frecuencia}</span>
            ) : null}
          </div>
        </div>

        <div className={style.rowMeta}>
          <div className={style.rowInfo}>
            <span>{formatDate(movimiento.fecha)}</span>
            <span>
              {isDebt
                ? movimiento.deudaEstado === "pagada"
                  ? `Pagada ${formatDate(movimiento.deudaPagadaAt)}`
                  : "Pendiente de pago"
                : movimiento.isVirtualOccurrence
                  ? "Renderizado automatico"
                  : "Movimiento manual"}
            </span>
          </div>

          <div className={style.rowSide}>
            <strong className={style.rowAmount}>{amountLabel}</strong>

            <div className={style.rowActions}>
              {isPendingDebt ? (
                <button
                  type="button"
                  className={style.payDebtButton}
                  onClick={() => handleStartSettleDebt(movimiento)}
                >
                  Ya lo pague
                </button>
              ) : null}
              <button
                type="button"
                className={style.actionButton}
                onClick={() => handleEditMovimiento(movimiento)}
                aria-label="Editar movimiento"
              >
                <img src="/edit.png" alt="edit" />
              </button>
              <button
                type="button"
                className={style.actionButton}
                onClick={() => handleDeleteMovimiento(movimiento)}
                aria-label="Eliminar movimiento"
              >
                <img src="/trush.png" alt="delete" />
              </button>
            </div>
          </div>
        </div>

        {isSettlingThis ? (
          <div className={style.settlePanel}>
            <div className={style.settleGrid}>
              <div className={style.filterField}>
                <label htmlFor={`settle-date-${movementId}`}>Fecha de pago</label>
                <input
                  id={`settle-date-${movementId}`}
                  type="date"
                  value={settleDate}
                  onChange={(event) => setSettleDate(event.target.value)}
                  className={style.input}
                />
              </div>

              <div className={style.filterField}>
                <label htmlFor={`settle-method-${movementId}`}>Como lo pagaste</label>
                <select
                  id={`settle-method-${movementId}`}
                  value={settleMethod}
                  onChange={(event) => setSettleMethod(event.target.value)}
                  className={style.select}
                >
                  {MOVEMENT_METHOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={`${style.filterField} ${style.searchField}`}>
                <label htmlFor={`settle-detail-${movementId}`}>Detalle del pago</label>
                <input
                  id={`settle-detail-${movementId}`}
                  type="text"
                  value={settleDetail}
                  onChange={(event) => setSettleDetail(event.target.value)}
                  className={style.input}
                  placeholder="Referencia del pago"
                />
              </div>
            </div>

            <div className={style.settleActions}>
              <button
                type="button"
                className={style.confirmDebtButton}
                onClick={() => handleConfirmSettleDebt(movimiento)}
                disabled={settlingId === movementId}
              >
                {settlingId === movementId ? "Guardando..." : "Confirmar pago"}
              </button>
              <button
                type="button"
                className={style.cancelDebtButton}
                onClick={() => setSettleMovementId(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <section className={style.container}>
      <div className={style.hero}>
        <div>
          <p className={style.kicker}>Filtros avanzados</p>
          <p className={style.heroText}>
            Elige un mes, cambia entre pesos y dolares y revisa el detalle completo
            sin mezclar cajas.
          </p>
        </div>

        <div
          className={`${style.currencySwitch} ${
            currentCurrency === "USD" ? style.currencySwitchUsd : style.currencySwitchArs
          }`}
        >
          {CURRENCY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${style.currencyButton} ${
                currentCurrency === option.value ? style.currencyButtonActive : ""
              }`}
              onClick={() => onCurrencyChange?.(option.value)}
            >
              {option.codeLabel}
            </button>
          ))}
        </div>
      </div>

      <div className={style.filtersPanel}>
        <div className={style.filterField}>
          <label htmlFor="month-filter">Mes</label>
          <input
            id="month-filter"
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className={style.input}
          />
        </div>

        <div className={`${style.filterField} ${style.searchField}`}>
          <label htmlFor="search-filter">Busqueda</label>
          <input
            id="search-filter"
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Categoria, detalle, fecha o tipo"
            className={style.input}
          />
        </div>

        <div className={style.filterField}>
          <label htmlFor="type-filter">Tipo</label>
          <select
            id="type-filter"
            value={selectedType}
            onChange={(event) => setSelectedType(event.target.value)}
            className={style.select}
          >
            {TYPE_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={style.filterField}>
          <label htmlFor="recurrence-filter">Origen</label>
          <select
            id="recurrence-filter"
            value={selectedRecurrence}
            onChange={(event) => setSelectedRecurrence(event.target.value)}
            className={style.select}
          >
            {RECURRENCE_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={style.filterField}>
          <label htmlFor="method-filter">Medio</label>
          <select
            id="method-filter"
            value={selectedMethod}
            onChange={(event) => setSelectedMethod(event.target.value)}
            className={style.select}
          >
            {METHOD_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className={style.filterActions}>
          <button type="button" className={style.clearButton} onClick={clearFilters}>
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className={style.summaryStrip}>
     

        <article className={style.summaryCard}>
          <span>Ingresos</span>
          <strong>{formatMoney(filteredSummary.ingreso, currentCurrency)}</strong>
          <p>Entradas visibles con los filtros actuales.</p>
        </article>

        <article className={style.summaryCard}>
          <span>Egresos</span>
          <strong>{formatMoney(filteredSummary.egreso, currentCurrency)}</strong>
          <p>Salidas encontradas en este corte.</p>
        </article>

        <article className={style.summaryCard}>
          <span>Ahorros</span>
          <strong>{formatMoney(filteredSummary.ahorro, currentCurrency)}</strong>
          <p>Monto separado para reserva u objetivos.</p>
        </article>

        <article className={style.summaryCard}>
          <span>Deuda pendiente</span>
          <strong>{formatMoney(filteredSummary.deudaPendiente, currentCurrency)}</strong>
          <p>
            {filteredSummary.deudaPendienteCount || 0} registro
            {filteredSummary.deudaPendienteCount === 1 ? "" : "s"} pendiente
            {filteredSummary.deudaPendienteCount === 1 ? "" : "s"} en este corte.
          </p>
        </article>
      </div>

      <div className={style.detailsLayout}>
        <section className={style.dayPanel}>
          <div className={style.panelHeader}>
            <p className={style.panelKicker}>Filtra por dia</p>
            <h2>Movimientos del dia</h2>
          </div>

          <div className={style.dayFilterBar}>
            <div className={style.filterField}>
              <label htmlFor="day-filter">Fecha</label>
              <input
                id="day-filter"
                type="date"
                value={selectedDay}
                onChange={(event) => setSelectedDay(event.target.value)}
                className={style.input}
              />
            </div>

            <article className={style.daySummaryCard}>
              <span>Total del dia</span>
              <strong>
                {formatMoney(
                  summarizeByType(dayMovimientos).total,
                  currentCurrency
                )}
              </strong>
              <p>{formatDate(selectedDayDate)}</p>
            </article>
          </div>

          <div className={style.listShell}>
            {dayMovimientos.length === 0 ? (
              <div className={style.emptyState}>
                <h3>No hay movimientos para ese dia</h3>
                <p>Cambia la fecha del calendario para revisar otra jornada.</p>
              </div>
            ) : (
              <div className={style.list}>{dayMovimientos.map(renderMovementRow)}</div>
            )}
          </div>
        </section>

        <section className={style.listPanel}>
          <div className={style.panelHeader}>
            <p className={style.panelKicker}>Detalle del mes</p>
            <h2>Movimientos encontrados</h2>
           
          </div>

          <div className={style.listShell}>
            {filteredMovimientos.length === 0 ? (
              <div className={style.emptyState}>
                <h3>No hay movimientos para mostrar</h3>
                <p>Cambia el mes o limpia filtros para revisar otra combinacion.</p>
              </div>
            ) : (
              <div className={style.list}>{filteredMovimientos.map(renderMovementRow)}</div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

export default MonthlyFilters;
