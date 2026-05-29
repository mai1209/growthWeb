import { useMemo, useState } from "react";
//import { useNavigate } from "react-router-dom";
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
  
  movimientos = [],
  currentCurrency,
  onCurrencyChange,
}) {
  //const navigate = useNavigate();
  const [areTotalsVisible, setAreTotalsVisible] = useState(true);

  const currencyMeta = getCurrencyMeta(currentCurrency);

  const currencyMovimientos = useMemo(() => {
  const result = filterMovimientosByCurrency(movimientos, currentCurrency);
  return Array.isArray(result) ? result : [];
}, [movimientos, currentCurrency]);

  const monthMovimientos = useMemo(() => {
  const safeMovimientos = Array.isArray(currencyMovimientos)
    ? currencyMovimientos
    : [];

  return safeMovimientos.filter((movimiento) =>
    isSameMonth(movimiento.fecha)
  );
}, [currencyMovimientos]);

  const historicalSummary = useMemo(
    () => summarizeByType(currencyMovimientos),
    [currencyMovimientos]
  );

  const monthSummary = useMemo(
    () => summarizeByType(monthMovimientos),
    [monthMovimientos]
  );
  const monthResultLabel =
    monthSummary.total > 0 ? "Mes positivo" : monthSummary.total < 0 ? "Mes en rojo" : "Mes equilibrado";

  const hideableMoney = (amount) =>
    areTotalsVisible ? formatMoney(amount, currentCurrency) : "••••";

  return (
    <aside className={style.container}>
      <div className={style.panel}>
        <div className={style.balanceCard}>
          <div className={style.headerBlock}>
            <p className={style.eyebrow}>Panel de control</p>
            <h2>Tu caja en {currencyMeta.label.toLowerCase()}</h2>
          </div>

          <div className={style.balanceBody}>
            <p className={style.balanceLabel}>Saldo acumulado</p>
            <p className={style.balanceValue}>
              {hideableMoney(historicalSummary.total)}
            </p>
         
          </div>

          <div className={style.balanceFooter}>
            <span className={style.statusPill}>{monthResultLabel}</span>
            <button
              type="button"
              onClick={() => setAreTotalsVisible((prev) => !prev)}
              className={style.visibilityButton}
            >
              {areTotalsVisible ? "Ocultar" : "Mostrar"}
            </button>
          </div>
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
          <article className={`${style.statCard} ${style.statMovimientos}`}>
            <span>Movimientos del mes</span>
            <strong>{monthMovimientos.length}</strong>
          </article>

          <article className={`${style.statCard} ${style.statTotal}`}>
            <span>Resultado mensual</span>
            <strong>{hideableMoney(monthSummary.total)}</strong>
          </article>

          <article className={`${style.statCard} ${style.statIngreso}`}>
            <span>Ingresos del mes</span>
            <strong>{hideableMoney(monthSummary.ingreso)}</strong>
          </article>

          <article className={`${style.statCard} ${style.statEgreso}`}>
            <span>Egresos del mes</span>
            <strong>{hideableMoney(monthSummary.egreso)}</strong>
          </article>

          <article className={`${style.statCard} ${style.statAhorro}`}>
            <span>Ahorro del mes</span>
            <strong>{hideableMoney(monthSummary.ahorro)}</strong>
          </article>

          <article className={`${style.statCard} ${style.statDeuda}`}>
            <span>Deuda pendiente</span>
            <strong>{hideableMoney(historicalSummary.deudaPendiente)}</strong>
          </article>
        </div>

     
      </div>
    </aside>
  );
}

export default LeftSite;
