import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import style from "../style/LeftSite.module.css";
import {
  filterMovimientosByCurrency,
  formatMoney,
  getCurrencyMeta,
  isSameMonth,
  summarizeByType,
} from "../utils/finance";

const HOME_TABS = [
  { key: "ARS", label: "ARS" },
  { key: "USD", label: "USD" },
  { key: "deuda", label: "Deudas" },
  { key: "ahorro", label: "Ahorros" },
];

const fmtShortDate = (value) => {
  const parts = String(value || "").slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : "";
};

function LeftSite({

  movimientos = [],
  currentCurrency,
  onCurrencyChange,
}) {
  const navigate = useNavigate();
  const [areTotalsVisible, setAreTotalsVisible] = useState(true);
  const [viewTab, setViewTab] = useState("money"); // money | deuda | ahorro

  const activeTabKey = viewTab === "money" ? currentCurrency : viewTab;
  const handleTabClick = (key) => {
    if (key === "ARS" || key === "USD") {
      setViewTab("money");
      onCurrencyChange?.(key);
    } else {
      setViewTab(key);
    }
  };

  // Movimientos del tipo activo (deuda / ahorro), más recientes primero
  const typeMovs = useMemo(() => {
    if (viewTab === "money") return [];
    return movimientos
      .filter((m) => m.tipo === viewTab)
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  }, [movimientos, viewTab]);

  // Lleva a la página de Filtros con el tipo aplicado (o sin filtro si tipo es null)
  const goToFilter = (tipo) => {
    navigate(tipo ? `/filtros?tipo=${tipo}` : "/filtros");
  };

  const handleCardKeyDown = (event, tipo) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      goToFilter(tipo);
    }
  };

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
        {/* Pestañas ARS · USD · Deudas · Ahorros (como la app) */}
        <div className={style.segmentTabs}>
          {HOME_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`${style.segmentTab} ${
                t.key === activeTabKey ? style.segmentTabActive : ""
              }`}
              onClick={() => handleTabClick(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {viewTab === "money" ? (
          /* Tarjeta de saldo estilo credit card */
          <div className={style.creditCard}>
            <div className={style.ccTop}>
              <p className={style.ccKicker}>Saldo total</p>
              <button
                type="button"
                onClick={() => setAreTotalsVisible((prev) => !prev)}
                className={style.ccEye}
                aria-label={areTotalsVisible ? "Ocultar saldo" : "Mostrar saldo"}
                title={areTotalsVisible ? "Ocultar saldo" : "Mostrar saldo"}
              >
                {areTotalsVisible ? <FiEye /> : <FiEyeOff />}
              </button>
            </div>

            <p className={style.ccBalance}>{hideableMoney(historicalSummary.total)}</p>

            <div className={style.ccFooter}>
              <span className={style.statusPill}>{monthResultLabel}</span>
              <span className={style.ccCurrency}>{currencyMeta.codeLabel}</span>
            </div>
          </div>
        ) : (
          /* Lista de deudas / ahorros (como la app) */
          <div className={style.typePanel}>
            <div className={style.typeHead}>
              <div>
                <h2 className={style.typeTitle}>{viewTab === "deuda" ? "Deudas" : "Ahorros"}</h2>
                <p className={style.typeCount}>
                  {typeMovs.length} {typeMovs.length === 1 ? "movimiento" : "movimientos"}
                </p>
              </div>
              <button
                type="button"
                className={style.typeAdd}
                onClick={() => navigate("/add")}
              >
                {viewTab === "deuda" ? "Cargar deuda" : "Nuevo ahorro"}
              </button>
            </div>

            {typeMovs.length === 0 ? (
              <p className={style.typeEmpty}>
                No hay {viewTab === "deuda" ? "deudas" : "ahorros"} cargados todavía.
              </p>
            ) : (
              <div className={style.typeList}>
                {typeMovs.map((m) => {
                  const isPaid = m.tipo === "deuda" && m.deudaEstado === "pagada";
                  const isPartial = m.tipo === "deuda" && !isPaid && Number(m.deudaPagado) > 0;
                  return (
                    <button
                      key={m._id}
                      type="button"
                      className={style.typeItem}
                      onClick={() => goToFilter(viewTab)}
                    >
                      <span className={style.typeItemMain}>
                        <strong>{m.categoria || "Sin categoría"}</strong>
                        {m.deudaAcreedor ? (
                          <small>Acreedor: {m.deudaAcreedor}</small>
                        ) : m.detalle ? (
                          <small>{m.detalle}</small>
                        ) : null}
                        <span className={style.typeItemMeta}>
                          {fmtShortDate(m.fecha)}
                          {m.tipo === "deuda" ? (
                            <i
                              className={`${style.typeChip} ${
                                isPaid
                                  ? style.typeChipPaid
                                  : isPartial
                                    ? style.typeChipPartial
                                    : style.typeChipPending
                              }`}
                            >
                              {isPaid ? "Pagada" : isPartial ? "Parcial" : "Pendiente"}
                            </i>
                          ) : null}
                        </span>
                      </span>
                      <strong className={style.typeItemAmount}>
                        {areTotalsVisible ? formatMoney(m.monto, m.moneda || "ARS") : "••••"}
                      </strong>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {viewTab === "money" ? (
        <div className={style.statGrid}>
          <article
            className={`${style.statCard} ${style.statMovimientos} ${style.statClickable}`}
            role="button"
            tabIndex={0}
            onClick={() => goToFilter(null)}
            onKeyDown={(event) => handleCardKeyDown(event, null)}
          >
            <span>Movimientos del mes</span>
            <strong>{monthMovimientos.length}</strong>
          </article>

          <article
            className={`${style.statCard} ${style.statTotal} ${style.statClickable}`}
            role="button"
            tabIndex={0}
            onClick={() => goToFilter(null)}
            onKeyDown={(event) => handleCardKeyDown(event, null)}
          >
            <span>Resultado mensual</span>
            <strong>{hideableMoney(monthSummary.total)}</strong>
          </article>

          <article
            className={`${style.statCard} ${style.statIngreso} ${style.statClickable}`}
            role="button"
            tabIndex={0}
            onClick={() => goToFilter("ingreso")}
            onKeyDown={(event) => handleCardKeyDown(event, "ingreso")}
          >
            <span>Ingresos del mes</span>
            <strong>{hideableMoney(monthSummary.ingreso)}</strong>
          </article>

          <article
            className={`${style.statCard} ${style.statEgreso} ${style.statClickable}`}
            role="button"
            tabIndex={0}
            onClick={() => goToFilter("egreso")}
            onKeyDown={(event) => handleCardKeyDown(event, "egreso")}
          >
            <span>Egresos del mes</span>
            <strong>{hideableMoney(monthSummary.egreso)}</strong>
          </article>

          <article
            className={`${style.statCard} ${style.statAhorro} ${style.statClickable}`}
            role="button"
            tabIndex={0}
            onClick={() => goToFilter("ahorro")}
            onKeyDown={(event) => handleCardKeyDown(event, "ahorro")}
          >
            <span>Ahorro del mes</span>
            <strong>{hideableMoney(monthSummary.ahorro)}</strong>
          </article>

          <article
            className={`${style.statCard} ${style.statDeuda} ${style.statClickable}`}
            role="button"
            tabIndex={0}
            onClick={() => goToFilter("deuda")}
            onKeyDown={(event) => handleCardKeyDown(event, "deuda")}
          >
            <span>Deuda pendiente</span>
            <strong>{hideableMoney(historicalSummary.deudaPendiente)}</strong>
          </article>
        </div>
        ) : null}
      </div>
    </aside>
  );
}

export default LeftSite;
