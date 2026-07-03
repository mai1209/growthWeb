import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiArrowDownRight, FiArrowUpRight, FiCheck, FiChevronDown, FiFilter } from "react-icons/fi";
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

const formatMonthHeading = (monthValue) => {
  const [year, month] = monthValue.split("-").map(Number);

  if (!year || !month) {
    return "Mes actual";
  }

  return new Date(year, month - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
};

const formatDate = (value) => {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getLocalDayKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
};

const formatGroupLabel = (value) => {
  const date = new Date(value);
  return `Día · ${date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })}`;
};

const groupMovimientosByDay = (items) => {
  const grouped = items.reduce((accumulator, movimiento) => {
    const key = getLocalDayKey(movimiento.fecha);

    if (!accumulator.has(key)) {
      accumulator.set(key, []);
    }

    accumulator.get(key).push(movimiento);
    return accumulator;
  }, new Map());

  return [...grouped.entries()].map(([key, movimientosDelGrupo]) => ({
    key,
    label: formatGroupLabel(movimientosDelGrupo[0]?.fecha),
    movimientos: movimientosDelGrupo,
  }));
};

function MonthlyFilters({
  movimientos = [],
  currentCurrency,
  onCurrencyChange,
  onMovementUpdate,
  onEditMovement,
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedMonth, setSelectedMonth] = useState(getMonthInputValue(new Date()));
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedRecurrence, setSelectedRecurrence] = useState("all");
  const [selectedMethod, setSelectedMethod] = useState("all");
  const [openPicker, setOpenPicker] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Si llegás desde el Home con ?tipo=ingreso/egreso/ahorro/deuda, aplicamos ese filtro
  // y abrimos el panel. Después limpiamos el query para que no se "pegue".
  useEffect(() => {
    const tipo = searchParams.get("tipo");
    if (!tipo) return;

    if (TYPE_FILTERS.some((option) => option.value === tipo)) {
      setSelectedType(tipo);
      setFiltersOpen(true);
    }

    const next = new URLSearchParams(searchParams);
    next.delete("tipo");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const getOptionLabel = (options, value) =>
    options.find((option) => option.value === value)?.label || "Todos";
  const [settleMovementId, setSettleMovementId] = useState(null);
  const [settleDate, setSettleDate] = useState(getDayInputValue(new Date()));
  const [settleMethod, setSettleMethod] = useState("efectivo");
  const [settleDetail, setSettleDetail] = useState("");
  const [settleMode, setSettleMode] = useState("full"); // full | partial
  const [settleAmount, setSettleAmount] = useState("");
  const [settlingId, setSettlingId] = useState(null);

  const { from, to } = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
  const selectedMonthLabel = useMemo(
    () => formatMonthHeading(selectedMonth),
    [selectedMonth]
  );

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
  const groupedFilteredMovimientos = useMemo(
    () => groupMovimientosByDay(filteredMovimientos),
    [filteredMovimientos]
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
    setSettleMode("full");
    setSettleAmount("");
  };

  const handleConfirmSettleDebt = async (movimiento) => {
    const movementId = movimiento.sourceId || movimiento._id;

    if (!movementId) return;

    const alreadyPaid = Number(movimiento.deudaPagado) || 0;
    const remaining = Number(movimiento.monto) - alreadyPaid;

    const payload = {
      fecha: settleDate,
      medio: settleMethod,
      detalle: settleDetail.trim(),
    };

    if (settleMode === "partial") {
      const amt = Number(settleAmount);
      if (!settleAmount || Number.isNaN(amt) || amt <= 0) {
        alert("Ingresá un monto válido a pagar.");
        return;
      }
      if (amt > remaining + 0.001) {
        alert(`El monto no puede superar lo que resta (${formatMoney(remaining, currentCurrency)}).`);
        return;
      }
      payload.amount = amt;
    }

    try {
      setSettlingId(movementId);
      await movimientoService.settleDebt(movementId, payload);
      setSettleMovementId(null);
      setSettleDetail("");
      setSettleAmount("");
      setSettleMode("full");
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
    const debtPaid = Number(movimiento.deudaPagado) || 0;
    const debtRemaining = Number(movimiento.monto) - debtPaid;
    const isPartialDebt = isPendingDebt && debtPaid > 0;
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
    const isPositive = amountLabel.trim().startsWith("+");
    const amountTone = amountLabel.trim().startsWith("-")
      ? style.amountNegative
      : isPositive
        ? style.amountPositive
        : "";

    return (
      <article key={movimiento._id} className={`${style.row} ${toneClass}`}>
        <div className={style.rowHead}>
          <span className={style.rowIcon}>
            {isPositive ? <FiArrowUpRight /> : <FiArrowDownRight />}
          </span>

          <div className={style.rowText}>
            <p className={style.rowCategory}>{movimiento.categoria}</p>
            <p className={style.rowDetail}>
              {movimiento.detalle || "Sin detalle"}
            </p>
            {isDebt && movimiento.deudaAcreedor ? (
              <p className={style.rowExtra}>Acreedor: {movimiento.deudaAcreedor}</p>
            ) : null}
          </div>

          <div className={style.rowActions}>
            {isPendingDebt ? (
              <button
                type="button"
                className={style.payDebtButton}
                onClick={() => handleStartSettleDebt(movimiento)}
              >
                Pagar
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
              {isPartialDebt ? "Parcial" : debtStatusMeta.label}
            </span>
          ) : null}
          {!isPendingDebt ? (
            <span className={style.badge}>{methodMeta.label}</span>
          ) : null}
          {movimiento.esRecurrente ? (
            <span className={style.badgeAccent}>Fijo {movimiento.frecuencia}</span>
          ) : null}
        </div>

        <div className={style.rowFooter}>
          <span className={style.rowDate}>
            {formatDate(movimiento.fecha)}
            {" · "}
            {isDebt
              ? movimiento.deudaEstado === "pagada"
                ? `Pagada ${formatDate(movimiento.deudaPagadaAt)}`
                : isPartialDebt
                  ? `Pagado ${formatMoney(debtPaid, currentCurrency)} · resta ${formatMoney(debtRemaining, currentCurrency)}`
                  : "Pendiente de pago"
              : movimiento.isVirtualOccurrence
                ? "Automático"
                : "Manual"}
          </span>

          <strong className={`${style.rowAmount} ${amountTone}`}>
            {amountLabel}
          </strong>
        </div>

        {isSettlingThis ? (
          <div
            className={style.settleOverlay}
            onClick={() => setSettleMovementId(null)}
          >
            <div
              className={style.settleModal}
              onClick={(event) => event.stopPropagation()}
            >
              <h4 className={style.settleModalTitle}>Pagar deuda</h4>
              <p className={style.settleModalSub}>
                {movimiento.categoria} · resta {formatMoney(debtRemaining, currentCurrency)}
              </p>

              <div className={style.modeRow}>
                <button
                  type="button"
                  className={`${style.modeBtn} ${settleMode === "full" ? style.modeBtnActive : ""}`}
                  onClick={() => setSettleMode("full")}
                >
                  Todo
                </button>
                <button
                  type="button"
                  className={`${style.modeBtn} ${settleMode === "partial" ? style.modeBtnActive : ""}`}
                  onClick={() => setSettleMode("partial")}
                >
                  Una parte
                </button>
              </div>

              {settleMode === "partial" ? (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settleAmount}
                  onChange={(event) => setSettleAmount(event.target.value)}
                  className={style.input}
                  placeholder={`Monto (máx ${formatMoney(debtRemaining, currentCurrency)})`}
                  autoFocus
                />
              ) : null}

              <input
                type="text"
                value={settleDetail}
                onChange={(event) => setSettleDetail(event.target.value)}
                className={style.input}
                placeholder="Detalle (opcional)"
              />

              <div className={style.settleActions}>
                <button
                  type="button"
                  className={style.cancelDebtButton}
                  onClick={() => setSettleMovementId(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={style.confirmDebtButton}
                  onClick={() => handleConfirmSettleDebt(movimiento)}
                  disabled={settlingId === movementId}
                >
                  {settlingId === movementId ? "..." : "Aceptar"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </article>
    );
  };

  const renderMovementGroup = (group) => (
    <section key={group.key} className={style.listGroup}>
      <div className={style.listGroupHeader}>
        <span>{group.label}</span>
      </div>

      <div className={style.listGroupRows}>
        {group.movimientos.map(renderMovementRow)}
      </div>
    </section>
  );

  return (
    <section className={style.container}>
      <div className={style.hero}>
        <div className={style.heroMonthBlock}>
          <p className={style.panelKicker}>Mes</p>
          <h1 className={style.heroMonthTitle}>{selectedMonthLabel}</h1>
        </div>
        <div className={style.heroActions}>
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

          <button
            type="button"
            className={`${style.filterToggle} ${filtersOpen ? style.filterToggleActive : ""}`}
            onClick={() => setFiltersOpen((prev) => !prev)}
          >
            <FiFilter />
            Filtrar
          </button>
        </div>
      </div>

      {filtersOpen ? (
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

        <div className={style.filterPickers}>
          <div className={style.filterField}>
            <label>Tipo</label>
            <button
              type="button"
              className={style.filterTrigger}
              onClick={() => setOpenPicker("type")}
            >
              <span>{getOptionLabel(TYPE_FILTERS, selectedType)}</span>
              <FiChevronDown />
            </button>
          </div>

          <div className={style.filterField}>
            <label>Origen</label>
            <button
              type="button"
              className={style.filterTrigger}
              onClick={() => setOpenPicker("recurrence")}
            >
              <span>{getOptionLabel(RECURRENCE_FILTERS, selectedRecurrence)}</span>
              <FiChevronDown />
            </button>
          </div>

          <div className={style.filterField}>
            <label>Medio</label>
            <button
              type="button"
              className={style.filterTrigger}
              onClick={() => setOpenPicker("method")}
            >
              <span>{getOptionLabel(METHOD_FILTERS, selectedMethod)}</span>
              <FiChevronDown />
            </button>
          </div>

          <button type="button" className={style.clearButton} onClick={clearFilters}>
            Limpiar filtros
          </button>
        </div>
      </div>
      ) : null}

      {openPicker ? (
        <div
          className={style.sheetOverlay}
          role="presentation"
          onClick={() => setOpenPicker(null)}
        >
          <div className={style.sheet} onClick={(event) => event.stopPropagation()}>
            <span className={style.sheetHandle} />
            <p className={style.sheetTitle}>
              {openPicker === "type"
                ? "Tipo"
                : openPicker === "recurrence"
                  ? "Origen"
                  : "Medio"}
            </p>
            <div className={style.sheetOptions}>
              {(openPicker === "type"
                ? TYPE_FILTERS
                : openPicker === "recurrence"
                  ? RECURRENCE_FILTERS
                  : METHOD_FILTERS
              ).map((option) => {
                const currentValue =
                  openPicker === "type"
                    ? selectedType
                    : openPicker === "recurrence"
                      ? selectedRecurrence
                      : selectedMethod;
                const isActive = option.value === currentValue;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`${style.sheetOption} ${isActive ? style.sheetOptionActive : ""}`}
                    onClick={() => {
                      if (openPicker === "type") setSelectedType(option.value);
                      else if (openPicker === "recurrence") setSelectedRecurrence(option.value);
                      else setSelectedMethod(option.value);
                      setOpenPicker(null);
                    }}
                  >
                    <span>{option.label}</span>
                    {isActive ? <FiCheck /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div className={style.summaryStrip}>
     

        <article className={`${style.summaryCard} ${style.summaryIncome}`}>
          <span>Ingresos</span>
          <strong>{formatMoney(filteredSummary.ingreso, currentCurrency)}</strong>
        </article>

        <article className={`${style.summaryCard} ${style.summaryExpense}`}>
          <span>Egresos</span>
          <strong>{formatMoney(filteredSummary.egreso, currentCurrency)}</strong>
        </article>

        <article className={`${style.summaryCard} ${style.summarySavings}`}>
          <span>Ahorros</span>
          <strong>{formatMoney(filteredSummary.ahorro, currentCurrency)}</strong>
        </article>

        <article className={`${style.summaryCard} ${style.summaryDebt}`}>
          <span>Deuda pendiente</span>
          <strong>{formatMoney(filteredSummary.deudaPendiente, currentCurrency)}</strong>
          <small className={style.summaryHint}>
            {filteredSummary.deudaPendienteCount || 0} pendiente
            {filteredSummary.deudaPendienteCount === 1 ? "" : "s"}
          </small>
        </article>
      </div>

      <div className={style.detailsLayout}>
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
              <div className={style.list}>
                {groupedFilteredMovimientos.map(renderMovementGroup)}
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

export default MonthlyFilters;
