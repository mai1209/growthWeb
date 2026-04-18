import { useMemo, useState } from "react";
import Add from "./Add";
import { FiX } from "react-icons/fi";
import Results from "./Results";
import style from "../style/App.module.css";
import {
  CURRENCY_OPTIONS,
  filterMovimientosByCurrency,
  formatMoney,
  getAverageTicket,
  getCurrencyMeta,
  getLatestMovimiento,
  getTopCategory,
  isSameMonth,
} from "../utils/finance";

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
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  const currencyMovimientos = useMemo(
    () => filterMovimientosByCurrency(movimientos, currentCurrency),
    [movimientos, currentCurrency]
  );

  const monthMovimientos = useMemo(
    () => currencyMovimientos.filter((movimiento) => isSameMonth(movimiento.fecha)),
    [currencyMovimientos]
  );

  const topExpense = useMemo(
    () => getTopCategory(monthMovimientos, "egreso"),
    [monthMovimientos]
  );

  const topIncome = useMemo(
    () => getTopCategory(monthMovimientos, "ingreso"),
    [monthMovimientos]
  );

  const latestMovimiento = useMemo(
    () => getLatestMovimiento(currencyMovimientos),
    [currencyMovimientos]
  );

  const averageTicket = useMemo(
    () => getAverageTicket(monthMovimientos),
    [monthMovimientos]
  );

  const handleEditClick = (movimiento) => {
    setMovementToEdit?.(movimiento);
    if (movimiento?.esRecurrente) {
      setShowOnly(movimiento.tipo === "ingreso" ? "ingreso-fijo" : "egreso-fijo");
      return;
    }

    setShowOnly(movimiento?.tipo || "ingreso");
  };

  const currencyMeta = getCurrencyMeta(currentCurrency);

  return (
    <div className={style.page}>
      <section className={style.hero}>
        <div className={style.heroCopy}>
          <p className={style.eyebrow}>Resumen financiero</p>
          <p className={style.heroText}>
            El panel filtra todo por moneda para que no mezcles cajas. Hoy estas
            mirando {currencyMeta.label.toLowerCase()}.
          </p>
        </div>

        <div className={style.heroControls}>
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

          <div className={style.quickActions}>
            <button
              type="button"
              className={style.primaryAction}
              onClick={() => setIsActionMenuOpen((prev) => !prev)}
            >
              Cargar movimiento
            </button>
            {isActionMenuOpen && (
              <div className={style.actionMenu}>
                <button
                  type="button"
                  className={style.incomeAction}
                  onClick={() => {
                    setShowOnly("ingreso");
                    setIsActionMenuOpen(false);
                  }}
                >
                  Nuevo ingreso
                </button>
                <button
                  type="button"
                  className={style.expenseAction}
                  onClick={() => {
                    setShowOnly("egreso");
                    setIsActionMenuOpen(false);
                  }}
                >
                  Nuevo egreso
                </button>
                <button
                  type="button"
                  className={style.savingsAction}
                  onClick={() => {
                    setShowOnly("ahorro");
                    setIsActionMenuOpen(false);
                  }}
                >
                  Nuevo ahorro
                </button>
                <button
                  type="button"
                  className={style.fixedIncomeAction}
                  onClick={() => {
                    setShowOnly("ingreso-fijo");
                    setIsActionMenuOpen(false);
                  }}
                >
                  Nuevo ingreso fijo
                </button>
                <button
                  type="button"
                  className={style.fixedExpenseAction}
                  onClick={() => {
                    setShowOnly("egreso-fijo");
                    setIsActionMenuOpen(false);
                  }}
                >
                  Nuevo gasto fijo
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={style.insightsSection}>
        <div className={style.insightsHeader}>
          <p className={style.eyebrow}>Lecturas utiles</p>
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
                    currentCurrency
                  )}`
                : "Todavia no cargaste movimientos"}
            </strong>
          </article>

          <article className={style.insightCard}>
            <span>Ticket promedio</span>
            <strong>{formatMoney(averageTicket, currentCurrency)}</strong>
          </article>
        </div>
      </section>

      <section className={style.contentLayout}>
        <div className={style.resultsColumn}>
          <Results
            movimientos={movimientos}
            refreshKey={refreshKey}
            onEditClick={handleEditClick}
            onMovementUpdate={onMovementUpdate}
            currentCurrency={currentCurrency}
            {...authProps}
          />
        </div>

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
                  Cargar {showOnly === "ingreso" ? "ingreso" : "egreso"}
                </p>
                <h2>Guarda movimientos en pesos o dolares desde el mismo flujo.</h2>
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
