import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiArrowDown,
  FiArrowUp,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiCreditCard,
  FiFilter,
  FiPocket,
  FiRepeat,
  FiSearch,
  FiTrash2,
  FiTrendingDown,
  FiTrendingUp,
  FiX,
  FiZap,
} from "react-icons/fi";
import style from "../style/MonthlyFilters.module.css";
import MovementCard from "./MovementCard";
import { movimientoService } from "../api";
import {
  CURRENCY_OPTIONS,
  MOVEMENT_METHOD_OPTIONS,
  MOVEMENT_TYPE_OPTIONS,
  filterMovimientosByCurrency,
  //getDebtStatusMeta,
  formatMoney,
  //formatSignedMoney,
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

// Colores por tipo (mismos que Métricas) para el resumen y la distribución
const TYPE_COLORS = {
  ingreso: "#9cfb43",
  egreso: "#ff915c",
  ahorro: "#58eba4",
  deuda: "#ffd55c",
};

const buildConicGradient = (items) => {
  const total = items.reduce((acc, item) => acc + item.value, 0);
  if (!total) return "conic-gradient(rgba(255,255,255,0.08) 0deg 360deg)";
  let cursor = 0;
  const stops = items
    .filter((item) => item.value > 0)
    .map((item) => {
      const start = cursor;
      const end = cursor + (item.value / total) * 360;
      cursor = end;
      return `${item.color} ${start}deg ${end}deg`;
    });
  return `conic-gradient(${stops.join(", ")})`;
};

// Mini sparkline de las cards: curva suave con el monto por día del período
const Spark = ({ data, color }) => {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => ({
    x: (i / Math.max(1, data.length - 1)) * 100,
    y: 26 - (v / max) * 22,
  }));
  const d = pts
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = pts[i - 1];
      const mx = (prev.x + p.x) / 2;
      return `C ${mx} ${prev.y}, ${mx} ${p.y}, ${p.x} ${p.y}`;
    })
    .join(" ");
  return (
    <svg className={style.sparkSvg} viewBox="0 0 100 28" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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

  // Período anterior (mes o año) para la comparación "+x% vs Agosto"
  const prevRange = useMemo(() => {
    if (period === "year") {
      const y = selectedYear - 1;
      return { from: new Date(y, 0, 1), to: new Date(y, 11, 31), label: String(y) };
    }
    const [y, m] = selectedMonth.split("-").map(Number);
    const base = y && m ? new Date(y, m - 2, 1) : new Date();
    const from = new Date(base.getFullYear(), base.getMonth(), 1);
    const to = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    const raw = from.toLocaleDateString("es-AR", { month: "long" });
    return { from, to, label: raw.charAt(0).toUpperCase() + raw.slice(1) };
  }, [period, selectedMonth, selectedYear]);

  const periodSummary = useMemo(() => summarizeByType(monthMovimientos), [monthMovimientos]);
  const prevSummary = useMemo(
    () =>
      summarizeByType(
        filterMovimientosByCurrency(movimientos, currentCurrency, {
          from: prevRange.from,
          to: prevRange.to,
        })
      ),
    [movimientos, currentCurrency, prevRange.from, prevRange.to]
  );

  const deltaPct = (curr, prev) => (prev > 0 ? ((curr - prev) / prev) * 100 : null);
  const deltaText = (curr, prev) => {
    const d = deltaPct(curr, prev);
    if (d === null) return `— vs ${prevRange.label}`;
    return `${d >= 0 ? "+" : ""}${d.toFixed(1)}% vs ${prevRange.label}`;
  };
  const deltaSign = (curr, prev) => {
    const d = deltaPct(curr, prev);
    return d === null ? 0 : d >= 0 ? 1 : -1;
  };

  // Sparklines: monto del tipo por día del período (por mes en vista año)
  const sparks = useMemo(() => {
    const isYear = period === "year";
    const count = isYear
      ? 12
      : Math.max(2, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
    const idxFor = (fecha) => {
      const date = new Date(fecha);
      if (isYear) return Math.min(11, Math.max(0, date.getMonth()));
      return Math.min(
        count - 1,
        Math.max(0, Math.round((date.getTime() - from.getTime()) / 86400000))
      );
    };
    const build = (tipo) => {
      const arr = Array(count).fill(0);
      monthMovimientos.forEach((movimiento) => {
        if (movimiento.tipo !== tipo) return;
        arr[idxFor(movimiento.fecha)] += Number(movimiento.monto) || 0;
      });
      return arr;
    };
    return {
      ingreso: build("ingreso"),
      egreso: build("egreso"),
      ahorro: build("ahorro"),
      deuda: build("deuda"),
    };
  }, [period, monthMovimientos, from, to]);

  // Items del anillo "Resumen del mes" y la distribución (columna derecha)
  const resumenItems = useMemo(
    () => [
      { label: "Ingresos", value: filteredSummary.ingreso, color: TYPE_COLORS.ingreso },
      { label: "Egresos", value: filteredSummary.egreso, color: TYPE_COLORS.egreso },
      { label: "Ahorros", value: filteredSummary.ahorro, color: TYPE_COLORS.ahorro },
      { label: "Deuda", value: filteredSummary.deudaPendiente, color: TYPE_COLORS.deuda },
    ],
    [filteredSummary]
  );
  const resumenTotal = resumenItems.reduce((acc, item) => acc + item.value, 0);

  const insightDelta = deltaPct(periodSummary.ingreso, prevSummary.ingreso);
  const insightText =
    insightDelta === null
      ? `Sin datos de ${prevRange.label} para comparar todavía.`
      : `Tus ingresos ${insightDelta >= 0 ? "aumentaron" : "bajaron"} un ${Math.abs(
          insightDelta
        ).toFixed(1)}% respecto a ${prevRange.label}.`;
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

  const renderMovementRow = (movimiento) => (
    <MovementCard
      key={movimiento._id}
      movimiento={movimiento}
      currentCurrency={currentCurrency}
      onEditMovement={onEditMovement}
      onMovementUpdate={onMovementUpdate}
    />
  );

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
            {filtersOpen ? <FiX /> : <FiFilter />}
            {filtersOpen ? "Ocultar filtros" : "Filtrar"}
          </button>
        </div>
      </div>

      {filtersOpen ? (
      <div className={style.filtersPanel}>
        <div className={`${style.filterField} ${style.searchField}`}>
          <label htmlFor="search-filter">Búsqueda</label>
          <div className={style.searchWrap}>
            <input
              id="search-filter"
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por categoría, detalle, fecha o tipo"
              className={style.input}
            />
            <FiSearch className={style.searchIcon} />
          </div>
        </div>

        <div className={style.filterPickers}>
          <div className={style.filterField}>
            <label>Tipo</label>
            <button
              type="button"
              className={style.filterTrigger}
              onClick={() => setOpenPicker("type")}
            >
              <i className={style.triggerIcon}>
                <FiFilter />
              </i>
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
              <i className={style.triggerIcon}>
                <FiRepeat />
              </i>
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
              <i className={style.triggerIcon}>
                <FiCreditCard />
              </i>
              <span>{getOptionLabel(METHOD_FILTERS, selectedMethod)}</span>
              <FiChevronDown />
            </button>
          </div>

          <button type="button" className={style.clearButton} onClick={clearFilters}>
            <FiTrash2 />
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
          <div className={style.summaryHead}>
            <i className={style.summaryIcon}>
              <FiTrendingUp />
            </i>
            <span>Ingresos</span>
          </div>
          <div className={style.summaryBody}>
            <strong>{formatMoney(filteredSummary.ingreso, currentCurrency)}</strong>
            <Spark data={sparks.ingreso} color={TYPE_COLORS.ingreso} />
          </div>
          <small
            className={`${style.summaryDelta} ${
              deltaSign(periodSummary.ingreso, prevSummary.ingreso) < 0 ? style.summaryDeltaNeg : ""
            }`}
          >
            {deltaText(periodSummary.ingreso, prevSummary.ingreso)}
          </small>
        </article>

        <article className={`${style.summaryCard} ${style.summaryExpense}`}>
          <div className={style.summaryHead}>
            <i className={style.summaryIcon}>
              <FiTrendingDown />
            </i>
            <span>Egresos</span>
          </div>
          <div className={style.summaryBody}>
            <strong>{formatMoney(filteredSummary.egreso, currentCurrency)}</strong>
            <Spark data={sparks.egreso} color={TYPE_COLORS.egreso} />
          </div>
          <small
            className={`${style.summaryDelta} ${
              deltaSign(periodSummary.egreso, prevSummary.egreso) < 0 ? style.summaryDeltaNeg : ""
            }`}
          >
            {deltaText(periodSummary.egreso, prevSummary.egreso)}
          </small>
        </article>

        <article className={`${style.summaryCard} ${style.summarySavings}`}>
          <div className={style.summaryHead}>
            <i className={style.summaryIcon}>
              <FiPocket />
            </i>
            <span>Ahorros</span>
          </div>
          <div className={style.summaryBody}>
            <strong>{formatMoney(filteredSummary.ahorro, currentCurrency)}</strong>
            <Spark data={sparks.ahorro} color={TYPE_COLORS.ahorro} />
          </div>
          <small
            className={`${style.summaryDelta} ${
              deltaSign(periodSummary.ahorro, prevSummary.ahorro) < 0 ? style.summaryDeltaNeg : ""
            }`}
          >
            {deltaText(periodSummary.ahorro, prevSummary.ahorro)}
          </small>
        </article>

        <article className={`${style.summaryCard} ${style.summaryDebt}`}>
          <div className={style.summaryHead}>
            <i className={style.summaryIcon}>
              <FiCreditCard />
            </i>
            <span>Deuda pendiente</span>
          </div>
          <div className={style.summaryBody}>
            <strong>{formatMoney(filteredSummary.deudaPendiente, currentCurrency)}</strong>
            <Spark data={sparks.deuda} color={TYPE_COLORS.deuda} />
          </div>
          <small className={style.summaryDelta}>
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
                        <small>Deuda</small>
                        <strong className={row.summary.deudaPendiente > 0 ? style.statNeg : ""}>
                          {formatMoney(row.summary.deudaPendiente, currentCurrency)}
                        </strong>
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

        {/* Columna derecha: Resumen del período + Distribución + Insights */}
        <aside className={style.sideCol}>
          <article className={style.sideCard}>
            <h3 className={style.sideTitle}>
              Resumen del {period === "year" ? "año" : "mes"}
            </h3>
            <div className={style.resumenLayout}>
              <div
                className={style.resumenRing}
                style={{ background: buildConicGradient(resumenItems) }}
              >
                <div className={style.resumenHole}>
                  <strong>{formatMoney(filteredSummary.total, currentCurrency)}</strong>
                  <span>Saldo neto</span>
                </div>
              </div>
              <div className={style.resumenLegend}>
                {resumenItems.map((item) => (
                  <div key={item.label} className={style.resumenRow}>
                    <i style={{ background: item.color }} />
                    <span>{item.label}</span>
                    <strong>{formatMoney(item.value, currentCurrency)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className={style.sideCard}>
            <h3 className={style.sideTitle}>Distribución</h3>
            <div className={style.distList}>
              {resumenItems.map((item) => {
                const pct = resumenTotal ? (item.value / resumenTotal) * 100 : 0;
                return (
                  <div key={item.label} className={style.distRow}>
                    <span className={style.distLabel}>{item.label}</span>
                    <div className={style.distTrack}>
                      <div
                        className={style.distFill}
                        style={{ width: `${Math.max(pct, item.value > 0 ? 2 : 0)}%`, background: item.color }}
                      />
                    </div>
                    <strong className={style.distPct}>{pct.toFixed(0)}%</strong>
                  </div>
                );
              })}
            </div>
          </article>

          <article className={`${style.sideCard} ${style.insightsCard}`}>
            <h3 className={style.sideTitle}>
              <FiZap /> Insights
            </h3>
            <p className={style.insightsText}>{insightText}</p>
            <button
              type="button"
              className={style.insightsLink}
              onClick={() => navigate("/metricas")}
            >
              Ver reporte completo <FiChevronRight />
            </button>
          </article>
        </aside>
      </div>
    </section>
  );
}

export default MonthlyFilters;
