import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Add from "./Add";
import { FiX } from "react-icons/fi";
import style from "../style/App.module.css";
import {
  CURRENCY_OPTIONS,
  filterMovimientosByCurrency,
  formatMoney,
  formatSignedMoney,
  getCurrencyMeta,
  getLatestMovimiento,
  getMovementMethodMeta,
  getMovementTypeMeta,
  getTopCategory,
  isSameMonth,
} from "../utils/finance";

const DASHBOARD_PERIODS = [
  { value: "day", label: "Hoy" },
  { value: "month", label: "Mensual" },
  { value: "year", label: "Anual" },
];

const getPeriodRange = (period) => {
  const now = new Date();

  if (period === "year") {
    return {
      from: new Date(now.getFullYear(), 0, 1),
      to: new Date(now.getFullYear(), 11, 31),
    };
  }

  if (period === "month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  }

  return {
    from: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    to: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
  };
};

const formatDashboardDate = (value) =>
  new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const getLocalDayKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

const getLocalMonthKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const formatDashboardGroupLabel = (value, period) => {
  const date = new Date(value);

  if (period === "year") {
    return `Mes · ${date.toLocaleDateString("es-AR", {
      month: "long",
      year: "numeric",
    })}`;
  }

  return `Día · ${date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })}`;
};

const groupMovimientosForDashboard = (items, period) => {
  const grouped = items.reduce((accumulator, movimiento) => {
    const key =
      period === "year"
        ? getLocalMonthKey(movimiento.fecha)
        : getLocalDayKey(movimiento.fecha);

    if (!accumulator.has(key)) {
      accumulator.set(key, []);
    }

    accumulator.get(key).push(movimiento);
    return accumulator;
  }, new Map());

  return [...grouped.entries()].map(([key, movimientosDelGrupo]) => ({
    key,
    label: formatDashboardGroupLabel(movimientosDelGrupo[0]?.fecha, period),
    movimientos: movimientosDelGrupo,
  }));
};

function Dashboard({
  movimientos = [],
  refreshKey,
  onMovementUpdate,
  movementToEdit,
  setMovementToEdit,
  currentCurrency,
  onCurrencyChange,
  ...authProps
}) {
  const [showOnly, setShowOnly] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("day");

  const currencyMovimientos = useMemo(
    () => filterMovimientosByCurrency(movimientos, currentCurrency),
    [movimientos, currentCurrency],
  );

  const monthMovimientos = useMemo(
    () =>
      currencyMovimientos.filter((movimiento) => isSameMonth(movimiento.fecha)),
    [currencyMovimientos],
  );

  const topExpense = useMemo(
    () => getTopCategory(monthMovimientos, "egreso"),
    [monthMovimientos],
  );

  const topIncome = useMemo(
    () => getTopCategory(monthMovimientos, "ingreso"),
    [monthMovimientos],
  );

  const latestMovimiento = useMemo(
    () => getLatestMovimiento(currencyMovimientos),
    [currencyMovimientos],
  );

  const periodRange = useMemo(
    () => getPeriodRange(selectedPeriod),
    [selectedPeriod],
  );
  const scopedMovimientos = useMemo(
    () =>
      filterMovimientosByCurrency(movimientos, currentCurrency, {
        from: periodRange.from,
        to: periodRange.to,
      }).sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      ),
    [movimientos, currentCurrency, periodRange.from, periodRange.to],
  );
  const groupedScopedMovimientos = useMemo(
    () => groupMovimientosForDashboard(scopedMovimientos, selectedPeriod),
    [scopedMovimientos, selectedPeriod],
  );

  const currencyMeta = getCurrencyMeta(currentCurrency);

  return (
    <div className={style.page}>
      <section className={style.overviewCard}>
        <section className={style.hero}>
          <div className={style.heroControls}>
            <div className={style.quickActions}>
              <button
                type="button"
                className={style.incomeAction}
                onClick={() => setShowOnly("ingreso")}
              >
                Nuevo ingreso
              </button>
              <button
                type="button"
                className={style.expenseAction}
                onClick={() => setShowOnly("egreso")}
              >
                Nuevo egreso
              </button>
              <button
                type="button"
                className={style.savingsAction}
                onClick={() => setShowOnly("ahorro")}
              >
                Nuevo ahorro
              </button>
              <button
                type="button"
                className={style.debtAction}
                onClick={() => setShowOnly("deuda")}
              >
                Cargar deuda
              </button>
              <button
                type="button"
                className={style.fixedIncomeAction}
                onClick={() => setShowOnly("ingreso-fijo")}
              >
                Ingreso fijo
              </button>
              <button
                type="button"
                className={style.fixedExpenseAction}
                onClick={() => setShowOnly("egreso-fijo")}
              >
                Gasto fijo
              </button>
            </div>

            <div
              className={`${style.currencySwitch} ${
                currentCurrency === "USD"
                  ? style.currencySwitchUsd
                  : style.currencySwitchArs
              }`}
            >
              {CURRENCY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${style.currencyButton} ${
                    currentCurrency === option.value
                      ? style.currencyButtonActive
                      : ""
                  }`}
                  onClick={() => onCurrencyChange?.(option.value)}
                >
                  {option.codeLabel}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className={style.insightsSection}>
          <div className={style.insightsHeader}>
            <h2>Lo mas relevante de este mes en {currencyMeta.codeLabel}</h2>
          </div>

          <div className={style.insightsGrid}>
            <article className={style.insightCard}>
              <span>Categoria con mayor egreso</span>
              <strong>
                {topExpense
                  ? `${topExpense.categoria} · ${formatMoney(topExpense.monto, currentCurrency)}`
                  : "Sin egresos este mes"}
              </strong>
            </article>

            <article className={style.insightCard}>
              <span>Categoria con mayor ingreso</span>
              <strong>
                {topIncome
                  ? `${topIncome.categoria} · ${formatMoney(topIncome.monto, currentCurrency)}`
                  : "Sin ingresos este mes"}
              </strong>
            </article>

            <article className={style.insightCard}>
              <span>Ultimo movimiento</span>
              <strong>
                {latestMovimiento
                  ? `${latestMovimiento.categoria} · ${formatMoney(
                      latestMovimiento.monto,
                      currentCurrency,
                    )}`
                  : "Todavia no cargaste movimientos"}
              </strong>
            </article>
          </div>
        </section>
      </section>

      <section className={style.contentLayout}>
        <section className={style.dashboardInfoCard}>
          <div className={style.dashboardInfoHeader}>
            <div>
              <p className={style.eyebrow}>Panel de movimientos</p>
              <h2>Detalle rápido del período</h2>
            </div>
            <span className={style.dashboardInfoBadge}>
              {currencyMeta.codeLabel}
            </span>
          </div>

          <div className={style.dashboardPeriodSwitch}>
            {DASHBOARD_PERIODS.map((period) => (
              <button
                key={period.value}
                type="button"
                className={`${style.dashboardPeriodButton} ${
                  selectedPeriod === period.value
                    ? style.dashboardPeriodButtonActive
                    : ""
                }`}
                onClick={() => setSelectedPeriod(period.value)}
              >
                {period.label}
              </button>
            ))}
          </div>

          <div className={style.dashboardMovementShell}>
            {scopedMovimientos.length === 0 ? (
              <div className={style.dashboardEmptyState}>
                <h3>No hay movimientos para mostrar</h3>
                <p>
                  Cambiá a otra vista o cargá un movimiento para verlo también
                  desde el home.
                </p>
              </div>
            ) : (
              <div className={style.dashboardMovementList}>
                {groupedScopedMovimientos.map((group) => (
                  <section
                    key={group.key}
                    className={style.dashboardMovementGroup}
                  >
                    <div className={style.dashboardMovementGroupHeader}>
                      <span>{group.label}</span>
                    </div>

                    <div className={style.dashboardMovementGroupRows}>
                      {group.movimientos.map((movimiento) => {
                        const typeMeta = getMovementTypeMeta(movimiento.tipo);
                        const methodMeta = getMovementMethodMeta(
                          movimiento.medio,
                        );
                        const isDebt = movimiento.tipo === "deuda";
                        const amountLabel =
                          typeMeta.signedAsPositive === null
                            ? formatMoney(movimiento.monto, currentCurrency)
                            : formatSignedMoney(
                                movimiento.monto,
                                currentCurrency,
                                typeMeta.signedAsPositive,
                              );
                        const toneClass =
                          movimiento.tipo === "ingreso"
                            ? style.dashboardIncomeRow
                            : movimiento.tipo === "ahorro"
                              ? style.dashboardSavingsRow
                              : movimiento.tipo === "deuda"
                                ? style.dashboardDebtRow
                                : style.dashboardExpenseRow;

                        return (
                          <article
                            key={movimiento._id}
                            className={`${style.dashboardMovementRow} ${toneClass}`}
                          >
                            <div className={style.dashboardMovementMain}>
                              <div>
                                <p className={style.dashboardMovementCategory}>
                                  {movimiento.categoria}
                                </p>
                                <p className={style.dashboardMovementDetail}>
                                  {movimiento.detalle || "Sin detalle"}
                                </p>
                              </div>

                              <div className={style.dashboardMovementBadges}>
                                <span className={style.dashboardBadge}>
                                  {typeMeta.label}
                                </span>
                                {isDebt && movimiento.deudaEstado ? (
                                  <span className={style.dashboardBadge}>
                                    {movimiento.deudaEstado === "pagada"
                                      ? "Pagada"
                                      : "Pendiente"}
                                  </span>
                                ) : null}
                                {!(
                                  isDebt && movimiento.deudaEstado !== "pagada"
                                ) ? (
                                  <span className={style.dashboardBadge}>
                                    {methodMeta.label}
                                  </span>
                                ) : null}
                                <span className={style.dashboardBadge}>
                                  {currencyMeta.codeLabel}
                                </span>
                              </div>
                            </div>

                            <div className={style.dashboardMovementMeta}>
                              <div className={style.dashboardMovementInfo}>
                                <span>
                                  {formatDashboardDate(movimiento.fecha)}
                                </span>
                                <span>
                                  {movimiento.isVirtualOccurrence
                                    ? "Renderizado automatico"
                                    : "Movimiento manual"}
                                </span>
                              </div>

                              <strong className={style.dashboardMovementAmount}>
                                {amountLabel}
                              </strong>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          <div className={style.dashboardInfoActions}>
            <Link to="/filtros" className={style.dashboardPrimaryLink}>
              Abrir filtros avanzados
            </Link>
            <button
              type="button"
              className={style.dashboardGhostButton}
              onClick={() => setShowOnly("ingreso")}
            >
              Cargar ingreso rapido
            </button>
          </div>
        </section>

        <aside className={style.promoSidebar}>
          <section className={style.promoCard}>
            <div className={style.promoCopy}>
              <p className={style.eyebrow}>Espacio publicitario</p>
            </div>

            <div className={style.promoMedia}>
              <img src="/publicidad.jpg" alt="publicidad" />
            </div>
          </section>
        </aside>
      </section>

      {showOnly && (
        <section
          className={style.modalOverlay}
          onClick={() => {
            setShowOnly(null);
            setMovementToEdit?.(null);
          }}
        >
          <div
            className={style.inlineForm}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={style.inlineFormHeader}>
              <div>
                <p className={style.inlineFormEyebrow}>
                  {showOnly === "deuda"
                    ? "Cargar deuda"
                    : `Cargar ${
                        showOnly === "ingreso"
                          ? "ingreso"
                          : showOnly === "egreso"
                            ? "egreso"
                            : showOnly === "ahorro"
                              ? "ahorro"
                              : "movimiento"
                      }`}
                </p>
                <h2>
                  {showOnly === "deuda"
                    ? "Registra lo pendiente ahora y pasalo a egreso real cuando lo pagues."
                    : "Guarda movimientos en pesos o dolares desde el mismo flujo."}
                </h2>
              </div>

              <button
                type="button"
                className={style.closeInlineForm}
                onClick={() => {
                  setShowOnly(null);
                  setMovementToEdit?.(null);
                }}
                aria-label="Cerrar formulario"
              >
                <FiX />
              </button>
            </div>

            <Add
              onMovementAdded={(savedMovement) => {
                onMovementUpdate?.(savedMovement);
                setShowOnly(null);
                setMovementToEdit?.(null);
              }}
              movementToEdit={movementToEdit}
              only={showOnly}
              defaultCurrency={currentCurrency}
            />
          </div>
        </section>
      )}
    </div>
  );
}

export default Dashboard;
