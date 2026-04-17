import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Add from "./Add";
import Results from "./Results";
import style from "../style/App.module.css";
import { CURRENCY_OPTIONS, getCurrencyMeta } from "../utils/finance";

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
  const navigate = useNavigate();
  const [showOnly, setShowOnly] = useState(null);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  const handleEditClick = (movimiento) => {
    setMovementToEdit?.(movimiento);
    navigate("/add");
  };

  const currencyMeta = getCurrencyMeta(currentCurrency);

  return (
    <div className={style.page}>
      <section className={style.hero}>
        <div className={style.heroCopy}>
          <p className={style.eyebrow}>Resumen financiero</p>
          <h1>Controla ingresos, egresos y notas con una vista mas clara.</h1>
          <p className={style.heroText}>
            El panel filtra todo por moneda para que no mezcles cajas. Hoy estas
            mirando {currencyMeta.label.toLowerCase()}.
          </p>
        </div>

        <div className={style.heroControls}>
          <div className={style.currencySwitch}>
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
              <h2>Promociona un servicio, un producto o una novedad importante.</h2>
              <p>
                Queda fijo al costado para acompañar el historial sin tapar la
                vista principal.
              </p>
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
          onClick={() => setShowOnly(null)}
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
                onClick={() => setShowOnly(null)}
              >
                Cerrar
              </button>
            </div>

            <Add
              onMovementAdded={(savedMovement) => {
                onMovementUpdate?.(savedMovement);
                setShowOnly(null);
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
