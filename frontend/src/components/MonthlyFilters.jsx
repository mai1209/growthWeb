import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiArrowDown,
  FiArrowUp,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiCreditCard,
  FiFilter,
  FiPocket,
  FiRepeat,
} from "react-icons/fi";
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

// Ícono por tipo de movimiento (mismo criterio minimalista que la app).
const movementIcon = (m) => {
  if (m.desdeAhorro) return <FiRepeat />;
  if (m.tipo === "ingreso") return <FiArrowDown />;
  if (m.tipo === "ahorro") return <FiPocket />;
  if (m.tipo === "deuda") return <FiCreditCard />;
  return <FiArrowUp />; // egreso
};

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
  const [period, setPeriod] = useState("month"); // month | year
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [facturaBusyId, setFacturaBusyId] = useState(null);
  const [facturaMsg, setFacturaMsg] = useState(null); // { ok, text }
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const monthInputRef = useRef(null);
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

  const { from, to } = useMemo(() => {
    if (period === "year") {
      return { from: new Date(selectedYear, 0, 1), to: new Date(selectedYear, 11, 31) };
    }
    return getMonthRange(selectedMonth);
  }, [period, selectedMonth, selectedYear]);
  const selectedMonthLabel = useMemo(
    () => formatMonthHeading(selectedMonth),
    [selectedMonth]
  );
  const periodLabel = period === "year" ? `Año ${selectedYear}` : selectedMonthLabel;

  // Años disponibles para el selector: rango razonable + los que tengan datos.
  const availableYears = useMemo(() => {
    const now = new Date().getFullYear();
    const set = new Set();
    for (let y = now + 1; y >= now - 7; y -= 1) set.add(y);
    movimientos.forEach((movimiento) => {
      const y = new Date(movimiento.fecha).getFullYear();
      if (y) set.add(y);
    });
    set.add(selectedYear);
    return Array.from(set).sort((a, b) => b - a);
  }, [movimientos, selectedYear]);

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
        if (selectedType === "ahorro") {
          // Ahorro incluye los usos de ahorro (egresos pagados con ahorro)
          if (movimiento.tipo !== "ahorro" && !movimiento.desdeAhorro) {
            return false;
          }
        } else if (selectedType === "egreso") {
          // Egreso excluye los usos de ahorro (viven en Ahorro)
          if (movimiento.tipo !== "egreso" || movimiento.desdeAhorro) {
            return false;
          }
        } else if (selectedType !== "all" && movimiento.tipo !== selectedType) {
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

  // Desglose por mes para la vista anual: SIEMPRE los 12 meses del año elegido
  // (Enero → Diciembre), con 0 en los meses sin movimientos.
  const monthBreakdown = useMemo(() => {
    if (period !== "year") return [];
    const map = new Map();
    filteredMovimientos.forEach((movimiento) => {
      const date = new Date(movimiento.fecha);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(movimiento);
    });
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const key = `${selectedYear}-${String(monthIndex + 1).padStart(2, "0")}`;
      const movs = map.get(key) || [];
      return {
        key,
        label: new Date(selectedYear, monthIndex, 1).toLocaleDateString("es-AR", {
          month: "long",
        }),
        summary: summarizeByType(movs),
        count: movs.length,
      };
    });
  }, [period, filteredMovimientos, selectedYear]);

  // Escala del mini gráfico anual (mayor ingreso/egreso mensual del año).
  const yearChartMax = useMemo(() => {
    if (period !== "year") return 1;
    return Math.max(
      1,
      ...monthBreakdown.flatMap((row) => [row.summary.ingreso, row.summary.egreso])
    );
  }, [period, monthBreakdown]);

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

  const handleEmitirFactura = async (movimiento) => {
    const movementId = movimiento.sourceId || movimiento._id;
    if (!movementId) return;
    setFacturaBusyId(movementId);
    setFacturaMsg(null);
    try {
      const res = await movimientoService.emitirFactura(movementId);
      const f = res.data?.factura;
      onMovementUpdate?.(res.data);
      setFacturaMsg({
        ok: true,
        text: f
          ? `Factura emitida: ${f.tipoNombre} N° ${f.numero} · CAE ${f.cae}`
          : "Factura emitida.",
      });
    } catch (err) {
      setFacturaMsg({
        ok: false,
        text: err.response?.data?.error || "No se pudo emitir la factura.",
      });
    } finally {
      setFacturaBusyId(null);
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
    // Color del monto según el tipo de movimiento
    const amountTone = movimiento.desdeAhorro
      ? style.amountAhorro
      : movimiento.tipo === "ingreso"
        ? style.amountIngreso
        : movimiento.tipo === "ahorro"
          ? style.amountAhorro
          : movimiento.tipo === "deuda"
            ? style.amountDeuda
            : style.amountEgreso;

    return (
      <article key={movimiento._id} className={`${style.row} ${toneClass}`}>
        <div className={style.rowHead}>
          <span className={style.rowIcon}>{movementIcon(movimiento)}</span>

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
          {movimiento.tipo === "ingreso" ? (
            movimiento.factura && movimiento.factura.cae ? (
              <span className={style.badgeAccent}>
                {movimiento.factura.tipoNombre} N° {movimiento.factura.numero}
              </span>
            ) : (
              <button
                type="button"
                className={style.facturaBtn}
                onClick={() => handleEmitirFactura(movimiento)}
                disabled={facturaBusyId === (movimiento.sourceId || movimiento._id)}
              >
                {facturaBusyId === (movimiento.sourceId || movimiento._id)
                  ? "Emitiendo..."
                  : "Emitir factura"}
              </button>
            )
          ) : null}
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
          {movimiento.desdeAhorro ? (
            <span className={style.badgeAccent}>Uso de ahorro</span>
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
          <p className={style.panelKicker}>{period === "year" ? "Año" : "Mes"}</p>
          <div className={style.heroTitleRow}>
            <h1 className={style.heroMonthTitle}>{periodLabel}</h1>
            {period === "month" ? (
              <button
                type="button"
                className={style.heroDateBtn}
                onClick={() => monthInputRef.current?.showPicker?.()}
                aria-label="Cambiar mes"
                title="Cambiar mes"
              >
                <FiCalendar />
                <input
                  ref={monthInputRef}
                  type="month"
                  className={style.heroDateHidden}
                  value={selectedMonth}
                  onChange={(event) => event.target.value && setSelectedMonth(event.target.value)}
                  tabIndex={-1}
                />
              </button>
            ) : (
              <div className={style.heroYearWrap}>
                <button
                  type="button"
                  className={style.heroDateBtn}
                  onClick={() => setYearMenuOpen((open) => !open)}
                  aria-label="Cambiar año"
                  title="Cambiar año"
                >
                  <FiCalendar />
                </button>
                {yearMenuOpen ? (
                  <div className={style.heroYearMenu}>
                    {availableYears.map((y) => (
                      <button
                        key={y}
                        type="button"
                        className={`${style.heroYearOption} ${
                          y === selectedYear ? style.heroYearOptionActive : ""
                        }`}
                        onClick={() => {
                          setSelectedYear(y);
                          setYearMenuOpen(false);
                        }}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
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
            <div>
              <p className={style.panelKicker}>
                {period === "year" ? "Resumen anual" : "Detalle del mes"}
              </p>
            </div>
            <div className={style.panelHeaderControls}>
              <div className={style.periodSwitch} role="tablist" aria-label="Período">
                <button
                  type="button"
                  className={`${style.periodButton} ${period === "month" ? style.periodButtonActive : ""}`}
                  onClick={() => setPeriod("month")}
                  aria-pressed={period === "month"}
                >
                  Mes
                </button>
                <button
                  type="button"
                  className={`${style.periodButton} ${period === "year" ? style.periodButtonActive : ""}`}
                  onClick={() => setPeriod("year")}
                  aria-pressed={period === "year"}
                >
                  Año
                </button>
              </div>
            </div>
          </div>

          {facturaMsg ? (
            <p className={facturaMsg.ok ? style.facturaMsgOk : style.facturaMsgErr}>
              {facturaMsg.text}
            </p>
          ) : null}

          {period === "year" ? (
            monthBreakdown.length === 0 ? (
              <div className={style.emptyState}>
                <h3>No hay movimientos este año</h3>
                <p>Probá otro año o limpiá los filtros.</p>
              </div>
            ) : (
              <>
                <div className={style.yearChart} aria-hidden="true">
                  {monthBreakdown.map((row) => {
                    const incH = Math.round((row.summary.ingreso / yearChartMax) * 100);
                    const expH = Math.round((row.summary.egreso / yearChartMax) * 100);
                    return (
                      <div
                        key={row.key}
                        className={style.chartCol}
                        title={`${row.label}: ingresos ${formatMoney(
                          row.summary.ingreso,
                          currentCurrency
                        )} · egresos ${formatMoney(row.summary.egreso, currentCurrency)}`}
                      >
                        <div className={style.chartBars}>
                          <span className={style.chartBarInc} style={{ height: `${incH}%` }} />
                          <span className={style.chartBarExp} style={{ height: `${expH}%` }} />
                        </div>
                        <span className={style.chartLabel}>{row.label.slice(0, 3)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className={style.monthGrid}>
                  {monthBreakdown.map((row) => (
                    <button
                      type="button"
                      key={row.key}
                      className={`${style.monthCard} ${row.count === 0 ? style.monthCardEmpty : ""}`}
                      onClick={() => {
                        setSelectedMonth(row.key);
                        setPeriod("month");
                      }}
                    >
                    <div className={style.monthCardHead}>
                      <span className={style.monthCardName}>{row.label}</span>
                      <span className={style.monthCardCount}>{row.count}</span>
                    </div>
                    <div className={style.monthCardStats}>
                      <div className={style.monthStat}>
                        <small>Ingresos</small>
                        <strong className={style.statPos}>
                          {formatMoney(row.summary.ingreso, currentCurrency)}
                        </strong>
                      </div>
                      <div className={style.monthStat}>
                        <small>Egresos</small>
                        <strong className={style.statNeg}>
                          {formatMoney(row.summary.egreso, currentCurrency)}
                        </strong>
                      </div>
                      <div className={style.monthStat}>
                        <small>Ahorro</small>
                        <strong>{formatMoney(row.summary.ahorro, currentCurrency)}</strong>
                      </div>
                      <div className={style.monthStat}>
                        <small>Balance</small>
                        <strong className={row.summary.total >= 0 ? style.statPos : style.statNeg}>
                          {formatMoney(row.summary.total, currentCurrency)}
                        </strong>
                      </div>
                    </div>
                    </button>
                  ))}
                </div>
              </>
            )
          ) : (
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
          )}
        </section>
      </div>
    </section>
  );
}

export default MonthlyFilters;
