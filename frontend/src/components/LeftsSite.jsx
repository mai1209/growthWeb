// Panel del Home de finanzas — mismo estilo, formato y flujo que el Home de la
// app: pestañas AR$/US$/Deudas/Ahorros en un contenedor redondeado, tarjeta de
// saldo (grafito por defecto) con historial/ojo/paleta y las 4 acciones
// adentro, y debajo el bloque Resumen / Historial (comparativa del mes contra
// el anterior, y los movimientos del mes agrupados por día y desplegables).
import { Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowDown,
  FiArrowUp,
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiChevronUp,
  FiClock,
  FiCreditCard,
  FiDroplet,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiFilter,
  FiInfo,
  FiLock,
  FiPocket,
  FiRepeat,
  FiRotateCcw,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { movimientoService } from "../api";
import style from "../style/LeftSite.module.css";
import {
  filterMovimientosByCurrency,
  formatMoney,
  formatSignedMoney,
  getMovementTypeMeta,
  isSameMonth,
  summarizeByType,
} from "../utils/finance";

const HOME_TABS = [
  { key: "ARS", label: "AR$" },
  { key: "USD", label: "US$" },
  { key: "deuda", label: "Deudas" },
  { key: "ahorro", label: "Ahorros" },
];

const fmtShortDate = (value) => {
  const parts = String(value || "").slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : "";
};

const CARD_STYLE_KEY = "gw-card-style";

// Estilos de la tarjeta de saldo (elegibles dando vuelta la tarjeta).
// "grafito" es el degradado gris de la app y queda como predeterminado.
const CARD_STYLES = {
  grafito: {
    swatch: "#4f4f4f",
    bg: "linear-gradient(135deg, #4f4f4f 0%, #7e7c7c 50%, #4f4f4f 100%)",
    text: "#ffffff",
    muted: "rgba(255, 255, 255, 0.72)",
  },
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
const CARD_ORDER = ["grafito", "holo", "platino", "titanio", "chrome", "esmeralda", "champagne"];

// Acciones de la tarjeta, como en la app: flecha verde ↓, flecha roja ↑,
// fijo = flecha + candado / reloj.
const QUICK_ACTIONS = [
  { key: "ingreso", label: "Ingreso", Icon: FiArrowDown, tone: "in" },
  { key: "egreso", label: "Egreso", Icon: FiArrowUp, tone: "out" },
  { key: "ingreso-fijo", label: "Ingreso fijo", Icon: FiArrowDown, Extra: FiLock, tone: "in" },
  { key: "egreso-fijo", label: "Gasto fijo", Icon: FiArrowUp, Extra: FiClock, tone: "out" },
];

// Ícono y tono según el tipo de movimiento (mismo criterio que la app).
const movementLook = (m) => {
  if (m.desdeAhorro) return { Icon: FiRepeat, tone: "tonoAhorro" };
  if (m.tipo === "ingreso") return { Icon: FiArrowDown, tone: "tonoIngreso" };
  if (m.tipo === "ahorro") return { Icon: FiPocket, tone: "tonoAhorro" };
  if (m.tipo === "deuda") return { Icon: FiCreditCard, tone: "tonoDeuda" };
  return { Icon: FiArrowUp, tone: "tonoEgreso" };
};

const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function LeftSite({

  movimientos = [],
  currentCurrency,
  onCurrencyChange,
  onUpdate,
  onEditMovement,
}) {
  const navigate = useNavigate();
  const [areTotalsVisible, setAreTotalsVisible] = useState(true);
  const [viewTab, setViewTab] = useState("money"); // money | deuda | ahorro
  const [infoOpen, setInfoOpen] = useState(false); // popup "cómo funciona"
  const [cardStyle, setCardStyle] = useState(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem(CARD_STYLE_KEY) : null;
    return saved && CARD_STYLES[saved] ? saved : "grafito";
  });
  const [cardFlipped, setCardFlipped] = useState(false);
  const currentCardStyle = CARD_STYLES[cardStyle] || CARD_STYLES.grafito;
  const [saldoInfoOpen, setSaldoInfoOpen] = useState(false); // popup info del saldo total
  const [resumenTab, setResumenTab] = useState("resumen"); // resumen | historial
  const [expandedMovs, setExpandedMovs] = useState(() => new Set()); // filas abiertas
  const [typeCurrency, setTypeCurrency] = useState("ARS"); // ARS/USD dentro de Deuda/Ahorro

  const toggleMovExpand = (id) =>
    setExpandedMovs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const chooseCard = (key) => {
    setCardStyle(key);
    try {
      localStorage.setItem(CARD_STYLE_KEY, key);
      window.dispatchEvent(new CustomEvent("gw-card-style", { detail: key }));
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
      .filter((m) => (m.moneda === "USD" ? "USD" : "ARS") === typeCurrency)
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  }, [movimientos, viewTab, typeCurrency]);

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

  const currencyTag = currentCurrency === "USD" ? "US$" : "AR$";

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

  // Mes anterior, para las variaciones del resumen ("+12% vs septiembre")
  const prevSummary = useMemo(() => {
    const ahora = new Date();
    const prev = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    return summarizeByType(currencyMovimientos.filter((m) => isSameMonth(m.fecha, prev)));
  }, [currencyMovimientos]);
  const mesNombre = new Date().toLocaleDateString("es-AR", { month: "long" });
  const mesPrevNombre = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 1, 1).toLocaleDateString("es-AR", {
      month: "long",
    });
  })();
  const deltaPct = (cur, prevV) => (prevV > 0 ? Math.round(((cur - prevV) / prevV) * 100) : null);

  // Movimientos del mes agrupados por día (más recientes primero)
  const monthGroups = useMemo(() => {
    const sorted = [...monthMovimientos].sort(
      (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
    );
    const grupos = [];
    sorted.forEach((m) => {
      const k = dayKey(new Date(m.fecha));
      let g = grupos[grupos.length - 1];
      if (!g || g.k !== k) {
        g = { k, items: [] };
        grupos.push(g);
      }
      g.items.push(m);
    });
    return grupos;
  }, [monthMovimientos]);

  const nombreDia = (k) => {
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    if (k === dayKey(hoy)) return "Hoy";
    if (k === dayKey(ayer)) return "Ayer";
    return new Date(`${k}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
  };

  const handleEditMov = (mov) => {
    onEditMovement?.(mov.sourceMovimiento || mov);
    navigate("/add");
  };

  const handleDeleteMov = async (mov) => {
    const id = mov.sourceId || mov._id;
    if (!id || !window.confirm(`¿Borrar "${mov.categoria || "movimiento"}"?`)) return;
    try {
      await movimientoService.delete(id);
      onUpdate?.();
    } catch {
      alert("No se pudo eliminar el movimiento");
    }
  };

  const hideableMoney = (amount) =>
    areTotalsVisible ? formatMoney(amount, currentCurrency) : "••••";

  return (
    <aside className={style.container}>
      <div className={style.panel}>
        {/* Contenedor redondeado de pestañas (borde gris). Con moneda activa,
            la tarjeta de saldo lo tapa desde la mitad, igual que en la app. */}
        <div className={`${style.tabsShell} ${viewTab === "money" ? style.tabsShellCard : ""}`}>
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
        </div>

        {viewTab === "money" ? (
          <>
          {/* Tarjeta de saldo — se da vuelta para elegir color */}
          <div className={`${style.ccFlip} ${style.ccOverlap}`}>
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
                  <p className={style.ccKicker}>
                    Saldo total
                    <button
                      type="button"
                      className={style.ccInfo}
                      onClick={() => setSaldoInfoOpen(true)}
                      aria-label="Qué es el saldo total"
                      title="Qué es el saldo total"
                    >
                      <FiInfo />
                    </button>
                  </p>
                  {/* Historial · Ojo · Paleta */}
                  <div className={style.ccActions}>
                    <button
                      type="button"
                      onClick={() => goToFilter(null)}
                      className={style.ccEye}
                      aria-label="Ver historial completo"
                      title="Historial completo"
                    >
                      <FiRotateCcw />
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
                    <button
                      type="button"
                      onClick={() => setCardFlipped(true)}
                      className={style.ccEye}
                      aria-label="Cambiar color de la tarjeta"
                      title="Cambiar color"
                    >
                      <FiDroplet />
                    </button>
                  </div>
                </div>

                {(() => {
                  // El monto se achica según su largo para que siempre entre en una línea.
                  const saldoStr = hideableMoney(historicalSummary.total);
                  const saldoSize =
                    saldoStr.length > 17
                      ? "1.15rem"
                      : saldoStr.length > 14
                      ? "1.4rem"
                      : saldoStr.length > 11
                      ? "1.65rem"
                      : "1.9rem";
                  return (
                    <p className={style.ccBalance} style={{ fontSize: saldoSize }}>
                      {saldoStr}
                    </p>
                  );
                })()}

                {/* Acciones dentro de la tarjeta: cargar ingreso / egreso / fijos */}
                <div className={style.ccQuickRow}>
                  {QUICK_ACTIONS.map(({ key, label, Icon, Extra, tone }) => (
                    <button
                      key={key}
                      type="button"
                      className={style.ccQuickItem}
                      onClick={() => navigate(`/add?tipo=${key}`)}
                    >
                      <span
                        className={`${style.ccQuickBtn} ${
                          tone === "in" ? style.ccQuickIn : style.ccQuickOut
                        }`}
                      >
                        <Icon />
                        {Extra ? <Extra className={style.ccQuickExtra} /> : null}
                      </span>
                      <span className={style.ccQuickLabel}>{label}</span>
                    </button>
                  ))}
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

          {/* ===== Bloque Resumen / Historial ===== */}
          <section className={style.ticket} aria-label="Resumen e historial del mes">
            <div className={style.ticketSwitchRow}>
              {resumenTab === "historial" ? (
                <button type="button" className={style.verTodos} onClick={() => goToFilter(null)}>
                  Ver todos <FiChevronRight />
                </button>
              ) : (
                <span />
              )}
              <div className={style.ticketSwitch}>
                {[
                  ["resumen", "Resumen"],
                  ["historial", "Historial"],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    className={`${style.ticketSeg} ${resumenTab === k ? style.ticketSegOn : ""}`}
                    onClick={() => setResumenTab(k)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {resumenTab === "resumen" ? (
              <div className={style.resPanel}>
                <div className={style.resPanelHead}>
                  <strong>Resumen del mes</strong>
                  <span>
                    {mesNombre} · {currencyTag}
                  </span>
                </div>

                {/* Barra proporcional ingresos (verde) vs egresos (rojo) */}
                {(() => {
                  const inM = monthSummary.ingreso || 0;
                  const outM = monthSummary.egreso || 0;
                  const total = inM + outM;
                  const pct = total ? Math.min(95, Math.max(5, (inM / total) * 100)) : 0;
                  return (
                    <div className={style.ratioBar}>
                      {total > 0 ? (
                        <>
                          {inM > 0 ? (
                            <span className={style.ratioIn} style={{ width: outM > 0 ? `${pct}%` : "100%" }} />
                          ) : null}
                          {outM > 0 ? <span className={style.ratioOut} style={{ flex: 1 }} /> : null}
                        </>
                      ) : null}
                    </div>
                  );
                })()}

                <div className={style.ieRow}>
                  {[
                    { label: "Ingresos", Icon: FiArrowDown, tone: style.tonoIngreso, val: monthSummary.ingreso || 0, prev: prevSummary.ingreso || 0, buenoSiSube: true, tipo: "ingreso" },
                    { label: "Egresos", Icon: FiArrowUp, tone: style.tonoEgreso, val: monthSummary.egreso || 0, prev: prevSummary.egreso || 0, buenoSiSube: false, tipo: "egreso" },
                  ].map((c, i) => {
                    const d = deltaPct(c.val, c.prev);
                    const favorable = d != null && (c.buenoSiSube ? d >= 0 : d <= 0);
                    return (
                      <Fragment key={c.label}>
                        {i > 0 ? <span className={style.ieSep} /> : null}
                        <button type="button" className={style.ieCol} onClick={() => goToFilter(c.tipo)}>
                          <span className={style.ieHead}>
                            <c.Icon className={c.tone} />
                            {c.label}
                          </span>
                          <strong className={`${style.ieVal} ${c.tone}`}>{hideableMoney(c.val)}</strong>
                          {d != null ? (
                            <small className={favorable ? style.ieDeltaOk : style.ieDeltaBad}>
                              {d > 0 ? "+" : ""}
                              {d}% vs {mesPrevNombre}
                            </small>
                          ) : (
                            <small className={style.ieDeltaMuted}>sin datos de {mesPrevNombre}</small>
                          )}
                        </button>
                      </Fragment>
                    );
                  })}
                </div>

                <div className={style.resDivider} />

                {/* Filas finas: ahorro, deuda y movimientos */}
                <button type="button" className={style.resSlimRow} onClick={() => goToFilter("ahorro")}>
                  <FiPocket className={style.tonoAhorro} />
                  <span>Ahorro del mes</span>
                  <strong className={style.tonoAhorro}>{hideableMoney(monthSummary.ahorro)}</strong>
                </button>
                <button type="button" className={style.resSlimRow} onClick={() => goToFilter("deuda")}>
                  <FiCreditCard className={style.tonoDeuda} />
                  <span>Deuda pendiente</span>
                  <strong className={style.tonoDeuda}>{hideableMoney(historicalSummary.deudaPendiente)}</strong>
                </button>
                <button type="button" className={style.resSlimRow} onClick={() => setResumenTab("historial")}>
                  <i className={style.movCountDot} />
                  <span>Movimientos del mes</span>
                  <strong>{areTotalsVisible ? monthMovimientos.length : "••"}</strong>
                  <FiChevronRight className={style.resSlimChevron} />
                </button>
              </div>
            ) : (
              <div className={style.histPanel}>
                {monthGroups.length === 0 ? (
                  <p className={style.typeEmpty}>No hay movimientos este mes.</p>
                ) : (
                  monthGroups.map((g) => (
                    <div key={g.k}>
                      <p className={style.movDayLabel}>{nombreDia(g.k)}</p>
                      {g.items.map((item, idx) => {
                        const meta = getMovementTypeMeta(item.tipo);
                        const look = movementLook(item);
                        const abierto = expandedMovs.has(item._id);
                        const isDebt = item.tipo === "deuda";
                        const isPendingDebt = isDebt && item.deudaEstado !== "pagada";
                        const debtPaid = Number(item.deudaPagado) || 0;
                        const debtRemaining = (Number(item.monto) || 0) - debtPaid;
                        const isPartialDebt = isPendingDebt && debtPaid > 0;
                        const monto = isDebt
                          ? formatMoney(item.monto, currentCurrency)
                          : formatSignedMoney(item.monto, currentCurrency, item.tipo === "ingreso");
                        return (
                          <div key={item._id} className={idx > 0 ? style.movDivider : undefined}>
                            <button
                              type="button"
                              className={style.movTop}
                              onClick={() => toggleMovExpand(item._id)}
                              aria-expanded={abierto}
                            >
                              <i className={`${style.movIcon} ${style[look.tone]}`}>
                                <look.Icon />
                              </i>
                              <span className={style.movInfo}>
                                <strong>{item.categoria || "Sin categoría"}</strong>
                                <small>
                                  {meta.label}
                                  {item.medio ? ` · ${item.medio}` : ""}
                                  {item.desdeAhorro ? " · Uso de ahorro" : ""}
                                </small>
                              </span>
                              <span className={style.movRight}>
                                <strong className={style[look.tone]}>
                                  {areTotalsVisible ? monto : "••••"}
                                </strong>
                                {isPendingDebt ? (
                                  <small>{isPartialDebt ? "Parcial" : "Pendiente"}</small>
                                ) : null}
                              </span>
                              {abierto ? (
                                <FiChevronUp className={style.movChevron} />
                              ) : (
                                <FiChevronDown className={style.movChevron} />
                              )}
                            </button>

                            {abierto ? (
                              <div className={style.movBody}>
                                {item.detalle ? <p>{item.detalle}</p> : null}
                                {isDebt && item.deudaAcreedor ? <p>Acreedor: {item.deudaAcreedor}</p> : null}
                                {isPendingDebt ? (
                                  <p className={style.tonoDeuda}>
                                    {isPartialDebt
                                      ? `Pagado ${formatMoney(debtPaid, currentCurrency)} · resta ${formatMoney(debtRemaining, currentCurrency)}`
                                      : "Pendiente de pago"}
                                  </p>
                                ) : null}
                                <div className={style.movActions}>
                                  {isPendingDebt ? (
                                    <button
                                      type="button"
                                      className={style.movPay}
                                      onClick={() => goToFilter("deuda")}
                                    >
                                      Pagar deuda
                                    </button>
                                  ) : (
                                    <span />
                                  )}
                                  <span className={style.movIcons}>
                                    <button
                                      type="button"
                                      onClick={() => handleEditMov(item)}
                                      aria-label="Editar movimiento"
                                      title="Editar"
                                    >
                                      <FiEdit2 />
                                    </button>
                                    <button
                                      type="button"
                                      className={style.movDelete}
                                      onClick={() => handleDeleteMov(item)}
                                      aria-label="Eliminar movimiento"
                                      title="Eliminar"
                                    >
                                      <FiTrash2 />
                                    </button>
                                  </span>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
          </>
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
                    {areTotalsVisible ? formatMoney(savingsPot[typeCurrency], typeCurrency) : "••••"}
                  </p>
                ) : (
                  <p className={style.typeCount}>
                    {typeMovs.length} {typeMovs.length === 1 ? "movimiento" : "movimientos"} en{" "}
                    {typeCurrency}
                  </p>
                )}
              </div>
              {/* Sub-switch ARS/USD para separar deuda/ahorro por moneda + ojo */}
              <div className={style.typeHeadRight}>
                <div className={style.curSwitch}>
                  {["ARS", "USD"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={typeCurrency === c ? style.curSwitchOn : ""}
                      onClick={() => setTypeCurrency(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={style.typeEye}
                  onClick={() => setAreTotalsVisible((prev) => !prev)}
                  aria-label={areTotalsVisible ? "Ocultar montos" : "Mostrar montos"}
                  title={areTotalsVisible ? "Ocultar montos" : "Mostrar montos"}
                >
                  {areTotalsVisible ? <FiEye /> : <FiEyeOff />}
                </button>
              </div>
            </div>

            <div className={style.typeActions}>
              <button
                type="button"
                className={`${style.typeAdd} ${viewTab === "deuda" ? style.typeAddDeuda : style.typeAddAhorro}`}
                onClick={() => navigate(`/add?tipo=${viewTab}`)}
              >
                {viewTab === "deuda" ? "Cargar deuda" : "Nuevo ahorro"}
              </button>
              {viewTab === "ahorro" ? (
                <button
                  type="button"
                  className={style.typeUse}
                  onClick={() => navigate("/add?tipo=ahorro-uso")}
                >
                  Usar ahorro
                </button>
              ) : null}
            </div>

            <p className={style.movDayLabel}>Movimientos</p>
            {typeMovs.length === 0 ? (
              <p className={style.typeEmpty}>
                No hay {viewTab === "deuda" ? "deudas" : "ahorros"} en {typeCurrency} todavía.
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
      </div>

      {saldoInfoOpen ? (
        <div className={style.infoOverlay} onClick={() => setSaldoInfoOpen(false)} role="presentation">
          <div
            className={style.infoModal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="Saldo total"
          >
            <div className={style.infoHead}>
              <h3>Saldo total</h3>
              <button
                type="button"
                className={style.infoClose}
                onClick={() => setSaldoInfoOpen(false)}
                aria-label="Cerrar"
              >
                <FiX />
              </button>
            </div>
            <div className={style.infoBody}>
              <p>
                El saldo total es la <strong>diferencia entre tus ingresos y tus egresos</strong>.
              </p>
              <p>
                Incluye todo junto: lo que movés en <strong>efectivo</strong> y en{" "}
                <strong>transferencia</strong>.
              </p>
              <p className={style.infoTip}>
                <FiFilter /> ¿Querés ver cuánto es en efectivo y cuánto en transferencia por
                separado? Buscalo en Filtros: cada movimiento muestra su medio.
              </p>
            </div>
            <div className={style.infoActions}>
              <button type="button" className={style.infoOk} onClick={() => setSaldoInfoOpen(false)}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
