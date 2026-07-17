import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiEye, FiEyeOff, FiInfo, FiX, FiDroplet, FiCheck } from "react-icons/fi";
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

const CARD_STYLE_KEY = "gw-card-style";

// Estilos de la tarjeta de saldo (elegibles dando vuelta la tarjeta).
const CARD_STYLES = {
  holo: {
    swatch: "#c8b8ff",
    bg: "linear-gradient(120deg, #a8e6ff 0%, #c8b8ff 25%, #ffc2e6 50%, #b8f5cf 72%, #a6d0ff 100%)",
    text: "#10151b",
    muted: "rgba(16, 21, 27, 0.62)",
  },
  platino: {
    swatch: "#dbe3ec",
    bg: "linear-gradient(135deg, #f4f7fa 0%, #c7d0da 22%, #eef2f6 44%, #aeb9c6 66%, #dfe6ee 100%)",
    text: "#10151b",
    muted: "rgba(16, 21, 27, 0.6)",
  },
  titanio: {
    swatch: "#6b7480",
    bg: "linear-gradient(150deg, #565f6a 0%, #8b95a1 26%, #2f363f 52%, #7a838f 74%, #3c434c 100%)",
    text: "#f2f8fb",
    muted: "rgba(242, 248, 251, 0.72)",
  },
  chrome: {
    swatch: "#2b3138",
    bg: "radial-gradient(circle at 78% 8%, rgba(255,255,255,0.22), transparent 42%), linear-gradient(160deg, #20252c 0%, #454c56 28%, #12161b 54%, #525a65 80%, #1a1e24 100%)",
    text: "#f2f8fb",
    muted: "rgba(242, 248, 251, 0.7)",
  },
  esmeralda: {
    swatch: "#16d97a",
    bg: "radial-gradient(circle at 82% 4%, rgba(120,255,180,0.6), transparent 46%), linear-gradient(135deg, #12c46f 0%, #23e58a 48%, #0c9a5c 100%)",
    text: "#08251a",
    muted: "rgba(8, 37, 26, 0.7)",
  },
  champagne: {
    swatch: "#d9b877",
    bg: "linear-gradient(135deg, #fbf3dd 0%, #d9b877 26%, #f6e9c6 50%, #c9a55f 74%, #ead6a3 100%)",
    text: "#2a2010",
    muted: "rgba(42, 32, 16, 0.62)",
  },
};
const CARD_ORDER = ["holo", "platino", "titanio", "chrome", "esmeralda", "champagne"];

function LeftSite({

  movimientos = [],
  currentCurrency,
  onCurrencyChange,
}) {
  const navigate = useNavigate();
  const [areTotalsVisible, setAreTotalsVisible] = useState(true);
  const [viewTab, setViewTab] = useState("money"); // money | deuda | ahorro
  const [infoOpen, setInfoOpen] = useState(false); // popup "cómo funciona"
  const [cardStyle, setCardStyle] = useState(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(CARD_STYLE_KEY) : null;
    return saved && CARD_STYLES[saved] ? saved : "holo";
  });
  const [cardFlipped, setCardFlipped] = useState(false);
  const currentCardStyle = CARD_STYLES[cardStyle] || CARD_STYLES.holo;
  const chooseCard = (key) => {
    setCardStyle(key);
    try {
      localStorage.setItem(CARD_STYLE_KEY, key);
    } catch {
      /* nada */
    }
    setCardFlipped(false);
  };

  const activeTabKey = viewTab === "money" ? currentCurrency : viewTab;
  const handleTabClick = (key) => {
    if (key === "ARS" || key === "USD") {
      setViewTab("money");
      onCurrencyChange?.(key);
    } else {
      setViewTab(key);
    }
  };

  // Movimientos del tipo activo (deuda / ahorro), más recientes primero.
  // En Ahorros entran también los usos (egresos pagados con ahorro).
  const typeMovs = useMemo(() => {
    if (viewTab === "money") return [];
    return movimientos
      .filter((m) =>
        viewTab === "ahorro" ? m.tipo === "ahorro" || m.desdeAhorro : m.tipo === viewTab
      )
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  }, [movimientos, viewTab]);

  // Ahorro disponible por moneda (ahorrado - usado)
  const savingsPot = useMemo(() => {
    const pot = { ARS: 0, USD: 0 };
    movimientos.forEach((m) => {
      const cur = m.moneda === "USD" ? "USD" : "ARS";
      const amount = Number(m.monto) || 0;
      if (m.tipo === "ahorro") pot[cur] += amount;
      else if (m.desdeAhorro) pot[cur] -= amount;
    });
    return pot;
  }, [movimientos]);

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
          /* Tarjeta de saldo — se da vuelta para elegir color */
          <div className={style.ccFlip}>
            <div className={`${style.ccFlipInner} ${cardFlipped ? style.ccFlipped : ""}`}>
              {/* Frente */}
              <div
                className={`${style.creditCard} ${style.ccFace}`}
                style={{
                  background: currentCardStyle.bg,
                  "--cardText": currentCardStyle.text,
                  "--cardMuted": currentCardStyle.muted,
                }}
              >
                <div className={style.ccTop}>
                  <p className={style.ccKicker}>Saldo total</p>
                  <div className={style.ccActions}>
                    <button
                      type="button"
                      onClick={() => setCardFlipped(true)}
                      className={style.ccEye}
                      aria-label="Cambiar color de la tarjeta"
                      title="Cambiar color"
                    >
                      <FiDroplet />
                    </button>
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
                </div>

                <p className={style.ccBalance}>{hideableMoney(historicalSummary.total)}</p>

                <div className={style.ccFooter}>
                  <span className={style.statusPill}>{monthResultLabel}</span>
                  <span className={style.ccCurrency}>{currencyMeta.codeLabel}</span>
                </div>
              </div>

              {/* Dorso: elegir color */}
              <div className={`${style.creditCard} ${style.ccFace} ${style.ccBack}`}>
                <p className={style.ccBackTitle}>Elegí un color de tarjeta</p>
                <div className={style.swatchRow}>
                  {CARD_ORDER.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className={`${style.swatch} ${cardStyle === k ? style.swatchActive : ""}`}
                      style={{ background: CARD_STYLES[k].swatch }}
                      onClick={() => chooseCard(k)}
                      aria-label={k}
                    >
                      {cardStyle === k ? <FiCheck /> : null}
                    </button>
                  ))}
                </div>
                <button type="button" className={style.ccBackDone} onClick={() => setCardFlipped(false)}>
                  Listo
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Lista de deudas / ahorros (como la app) */
          <div className={style.typePanel}>
            <div className={style.typeHead}>
              <div>
                <h2 className={style.typeTitle}>
                  {viewTab === "deuda" ? "Deudas" : "Ahorros"}
                  <button
                    type="button"
                    className={style.infoButton}
                    onClick={() => setInfoOpen(true)}
                    aria-label="Cómo funciona"
                    title="Cómo funciona"
                  >
                    <FiInfo />
                  </button>
                </h2>
                {viewTab === "ahorro" ? (
                  <p className={style.typePot}>
                    Disponible:{" "}
                    {areTotalsVisible
                      ? [
                          savingsPot.ARS !== 0 || savingsPot.USD === 0
                            ? formatMoney(savingsPot.ARS, "ARS")
                            : null,
                          savingsPot.USD !== 0 ? formatMoney(savingsPot.USD, "USD") : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "••••"}
                  </p>
                ) : (
                  <p className={style.typeCount}>
                    {typeMovs.length} {typeMovs.length === 1 ? "movimiento" : "movimientos"}
                  </p>
                )}
              </div>
              <div className={style.typeActions}>
                {viewTab === "ahorro" ? (
                  <button
                    type="button"
                    className={style.typeUse}
                    onClick={() => navigate("/add?tipo=ahorro-uso")}
                  >
                    Usar ahorro
                  </button>
                ) : null}
                <button
                  type="button"
                  className={style.typeAdd}
                  onClick={() => navigate(`/add?tipo=${viewTab}`)}
                >
                  {viewTab === "deuda" ? "Cargar deuda" : "Nuevo ahorro"}
                </button>
              </div>
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
                          {m.desdeAhorro ? (
                            <i className={`${style.typeChip} ${style.typeChipUse}`}>
                              Uso de ahorro
                            </i>
                          ) : null}
                        </span>
                      </span>
                      <strong
                        className={style.typeItemAmount}
                        style={{ color: m.tipo === "deuda" ? "#e6bc3f" : "#35cfa4" }}
                      >
                        {areTotalsVisible
                          ? `${m.desdeAhorro ? "- " : ""}${formatMoney(m.monto, m.moneda || "ARS")}`
                          : "••••"}
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

        {/* Publicidad chica para llenar el espacio libre del panel */}
        <section className={style.sideAd}>
          <p className={style.sideAdLabel}>Espacio publicitario</p>
          <img src="/publicidad.jpg" alt="publicidad" />
        </section>
      </div>

      {infoOpen ? (
        <div
          className={style.infoOverlay}
          onClick={() => setInfoOpen(false)}
          role="presentation"
        >
          <div
            className={style.infoModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label={viewTab === "deuda" ? "Cómo funcionan las deudas" : "Cómo funcionan los ahorros"}
          >
            <div className={style.infoHead}>
              <h3>
                {viewTab === "deuda" ? "Cómo funcionan las deudas" : "Cómo funcionan los ahorros"}
              </h3>
              <button
                type="button"
                className={style.infoClose}
                onClick={() => setInfoOpen(false)}
                aria-label="Cerrar"
              >
                <FiX />
              </button>
            </div>

            {viewTab === "deuda" ? (
              <div className={style.infoBody}>
                <p>Las deudas son plata que te deben o que tenés que pagar, y se llevan aparte del saldo.</p>
                <ul>
                  <li>
                    <strong>Cargar deuda:</strong> anotás lo pendiente. Queda en “Deuda pendiente”
                    y <em>no</em> mueve tu saldo todavía.
                  </li>
                  <li>
                    <strong>Cuando se cobra/paga:</strong> registrás el pago (total o parcial) y
                    recién ahí impacta como ingreso o egreso en tu saldo.
                  </li>
                  <li>
                    <strong>Pago parcial:</strong> podés ir descontando de a poco; la deuda muestra
                    cuánto queda.
                  </li>
                </ul>
                <p className={style.infoTip}>
                  Idea: usá deudas para lo que está “en el aire” y no ensucia tu saldo real hasta
                  que se concreta.
                </p>
              </div>
            ) : (
              <div className={style.infoBody}>
                <p>El ahorro es una “bolsita” aparte que sale de tu saldo. Así funciona el flujo real:</p>
                <ul>
                  <li>
                    <strong>1. Cargás saldo:</strong> primero registrás tus ingresos (tu plata
                    disponible del mes).
                  </li>
                  <li>
                    <strong>2. Nuevo ahorro:</strong> al guardar un ahorro, ese monto se
                    <strong> descuenta de tu saldo</strong> y se guarda en la bolsita de Ahorros.
                  </li>
                  <li>
                    <strong>3. Usar ahorro:</strong> cuando gastás <em>desde el ahorro</em>, se
                    descuenta <strong>solo de la bolsita de Ahorros</strong>, no de tu saldo del mes.
                  </li>
                  <li>
                    <strong>4. Tope:</strong> no podés usar más ahorro del que tenés disponible;
                    si querés seguir, primero cargás más ahorro.
                  </li>
                </ul>
                <p className={style.infoTip}>
                  En resumen: ahorrar mueve plata del saldo → a la bolsita. Usar ahorro gasta de la
                  bolsita, sin tocar el saldo del mes.
                </p>
              </div>
            )}

            <div className={style.infoActions}>
              <button
                type="button"
                className={style.infoOk}
                onClick={() => setInfoOpen(false)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

export default LeftSite;
