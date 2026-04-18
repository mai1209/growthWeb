import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import style from "../style/LeftSite.module.css";
import {
  CURRENCY_OPTIONS,
  filterMovimientosByCurrency,
  formatMoney,
  getCurrencyMeta,
  isSameMonth,
  summarizeByType,
} from "../utils/finance";

function LeftSite({
  refreshKey,
  movimientos = [],
  currentCurrency,
  onCurrencyChange,
}) {
  const navigate = useNavigate();
  const [areTotalsVisible, setAreTotalsVisible] = useState(true);

  const currencyMeta = getCurrencyMeta(currentCurrency);

  const currencyMovimientos = useMemo(
    () => filterMovimientosByCurrency(movimientos, currentCurrency),
    [movimientos, currentCurrency]
  );

  const monthMovimientos = useMemo(
    () => currencyMovimientos.filter((movimiento) => isSameMonth(movimiento.fecha)),
    [currencyMovimientos]
  );

  const historicalSummary = useMemo(
    () => summarizeByType(currencyMovimientos),
    [currencyMovimientos]
  );

  const monthSummary = useMemo(
    () => summarizeByType(monthMovimientos),
    [monthMovimientos]
  );

  const hideableMoney = (amount) =>
    areTotalsVisible ? formatMoney(amount, currentCurrency) : "••••";

  return (
    <aside className={style.container}>
      <div className={style.panel}>
        <div className={style.headerBlock}>
          <p className={style.eyebrow}>Panel de control</p>
          <h2 >Tu caja en {currencyMeta.label.toLowerCase()}</h2>
          <p className={style.headerText}>
            Cambia la moneda visible del panel y revisa rapido saldo, flujo del
            mes y notas de hoy.
          </p>
        </div>

      

        <div className={style.balanceCard}>
          <div>
            <p className={style.balanceLabel}>Saldo acumulado</p>
            <p className={style.balanceValue}>
              {hideableMoney(historicalSummary.total)}
            </p>
            <p className={style.balanceHint}>
              {currencyMovimientos.length} movimientos guardados en{" "}
              {currencyMeta.codeLabel}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setAreTotalsVisible((prev) => !prev)}
            className={style.visibilityButton}
          >
            {areTotalsVisible ? "Ocultar" : "Mostrar"}
          </button>
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
                option.value === currentCurrency ? style.currencyButtonActive : ""
              }`}
              onClick={() => onCurrencyChange?.(option.value)}
            >
              <span>{option.codeLabel}</span>
              <small>{option.label}</small>
            </button>
          ))}
        </div>

        <div className={style.statGrid}>
          <article className={`${style.statCard} ${style.statIngreso}`}>
            <span>Ingresos del mes</span>
            <strong>{hideableMoney(monthSummary.ingreso)}</strong>
          </article>

          <article className={`${style.statCard} ${style.statEgreso}`}>
            <span>Egresos del mes</span>
            <strong>{hideableMoney(monthSummary.egreso)}</strong>
          </article>

          <article className={`${style.statCard} ${style.statTotal}`}>
            <span>Resultado mensual</span>
            <strong>{hideableMoney(monthSummary.total)}</strong>
          </article>

          <article className={`${style.statCard} ${style.statAhorro}`}>
            <span>Ahorro del mes</span>
            <strong>{hideableMoney(monthSummary.ahorro)}</strong>
          </article>
        </div>

        <section className={style.section}>
          <div className={style.sectionTitle}>
            <h3>Accesos rapidos</h3>
            <p>Movete entre caja y notas sin perder contexto.</p>
          </div>

          <div className={style.quickActions}>
            <button type="button" onClick={() => navigate("/")}>
              Ver resumen
            </button>
            <button type="button" onClick={() => navigate("/add")}>
              Cargar movimiento
            </button>
            <button type="button" onClick={() => navigate("/notas")}>
              Ir a notas
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
}

export default LeftSite;
