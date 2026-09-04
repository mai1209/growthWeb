import { useMemo, useState } from "react";
import { FiActivity, FiClock, FiTrendingDown, FiTrendingUp } from "react-icons/fi";
import style from "../style/Metrics.module.css";
import {
  CURRENCY_OPTIONS,
  filterMovimientosByCurrency,
  formatMoney,
  getMovementTypeMeta,
  normalizeCurrency,
  summarizeByType,
} from "../utils/finance";

const PERIOD_OPTIONS = [
  { value: "month", label: "Mes" },
  { value: "quarter", label: "3 meses" },
  { value: "semester", label: "6 meses" },
  { value: "year", label: "Año" },
];

const TYPE_COLORS = {
  ingreso: "#9cfb43",
  egreso: "#ff915c",
  ahorro: "#58eba4",
  deuda: "#ffd55c",
};

const CATEGORY_COLORS = [
  "#9cfb43",
  "#ff915c",
  "#58eba4",
  "#ffd55c",
  "#69a7ff",
  "#f070b8",
];

const getMonthInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getMonthLabel = (date) =>
  date.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });

const getMonthKey = (date) => {
  const safeDate = new Date(date);
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getMonthRange = (monthValue) => {
  const [year, month] = monthValue.split("-").map(Number);
  const fallback = new Date();
  const safeYear = year || fallback.getFullYear();
  const safeMonth = month || fallback.getMonth() + 1;

  return {
    from: new Date(safeYear, safeMonth - 1, 1),
    to: new Date(safeYear, safeMonth, 0),
  };
};

const getPeriodRange = (period, monthValue, yearValue) => {
  if (period === "year") {
    const year = Number(yearValue) || new Date().getFullYear();

    return {
      from: new Date(year, 0, 1),
      to: new Date(year, 11, 31),
      label: `${year}`,
    };
  }

  const { to } = getMonthRange(monthValue);
  const monthCount = period === "quarter" ? 3 : period === "semester" ? 6 : 1;
  const from = new Date(to.getFullYear(), to.getMonth() - monthCount + 1, 1);

  return {
    from,
    to,
    label:
      monthCount === 1
        ? getMonthLabel(from)
        : `${getMonthLabel(from)} - ${getMonthLabel(to)}`,
  };
};

const buildConicGradient = (items) => {
  const total = items.reduce((acc, item) => acc + item.value, 0);
  let cursor = 0;

  if (!total) {
    return "conic-gradient(rgba(255,255,255,0.08) 0deg 360deg)";
  }

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

const buildMonthlyBuckets = (movimientos, from, to) => {
  const buckets = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);

  while (cursor <= end) {
    buckets.push({
      key: getMonthKey(cursor),
      label: getMonthLabel(cursor),
      ingreso: 0,
      egreso: 0,
      ahorro: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const bucketsByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  movimientos.forEach((movimiento) => {
    const type = movimiento.tipo;
    if (!["ingreso", "egreso", "ahorro"].includes(type)) return;

    const bucket = bucketsByKey.get(getMonthKey(movimiento.fecha));
    if (!bucket) return;

    bucket[type] += Number(movimiento.monto) || 0;
  });

  return buckets.map((bucket) => ({
    ...bucket,
    ingreso: Number(bucket.ingreso.toFixed(2)),
    egreso: Number(bucket.egreso.toFixed(2)),
    ahorro: Number(bucket.ahorro.toFixed(2)),
  }));
};

const truncLabel = (value, max = 12) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const compactMoney = (value) =>
  `$${new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;

// Cinta curva entre dos columnas (para el diagrama de flujo estilo sankey)
const ribbonPath = (x1, a0, a1, x2, b0, b1) => {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${a0} C ${mx} ${a0}, ${mx} ${b0}, ${x2} ${b0} L ${x2} ${b1} C ${mx} ${b1}, ${mx} ${a1}, ${x1} ${a1} Z`;
};

// Apila items proporcionalmente en una columna vertical
const stackSegments = (items, total, top, plot, gap) => {
  const usable = plot - gap * Math.max(0, items.length - 1);
  let cursor = top;
  return items.map((item) => {
    const height = Math.max(4, (item.value / total) * usable);
    const segment = { item, y0: cursor, y1: cursor + height };
    cursor += height + gap;
    return segment;
  });
};

// Flujo real de la plata: de dónde entró (izquierda) → a dónde fue (derecha).
// Versión con sentido del "sankey" decorativo del mockup.
const FlowChart = ({ leftItems, rightItems, currency }) => {
  const left = leftItems.filter((item) => item.value > 0).slice(0, 5);
  const right = rightItems.filter((item) => item.value > 0).slice(0, 6);
  const totalLeft = left.reduce((acc, item) => acc + item.value, 0);
  const totalRight = right.reduce((acc, item) => acc + item.value, 0);

  if (!totalLeft || !totalRight) {
    return (
      <p className={style.emptyText}>
        Para dibujar el flujo hacen falta ingresos y destinos (gastos/ahorro) en el período.
      </p>
    );
  }

  const W = 680;
  const TOP = 26;
  const PLOT = 250;
  const H = TOP + PLOT + 26;
  const GAP = 8;
  const LX = 190; // borde izquierdo de los nodos de ingreso
  const TX = 332; // tronco central
  const TW = 16;
  const RX = 478; // nodos de destino

  const lSegs = stackSegments(left, totalLeft, TOP, PLOT, GAP);
  const rSegs = stackSegments(right, totalRight, TOP, PLOT, GAP);
  const lTrunk = stackSegments(left, totalLeft, TOP, PLOT, 2);
  const rTrunk = stackSegments(right, totalRight, TOP, PLOT, 2);

  return (
    <div className={style.flowWrap}>
      <svg className={style.flowSvg} viewBox={`0 0 ${W} ${H}`} role="img">
        {/* Cintas: ingresos → tronco */}
        {lSegs.map((seg, index) => (
          <path
            key={`l-${seg.item.label}`}
            d={ribbonPath(LX + 10, seg.y0, seg.y1, TX, lTrunk[index].y0, lTrunk[index].y1)}
            fill={seg.item.color}
            opacity="0.45"
          >
            <title>{`${seg.item.label} · ${formatMoney(seg.item.value, currency)}`}</title>
          </path>
        ))}
        {/* Cintas: tronco → destinos */}
        {rSegs.map((seg, index) => (
          <path
            key={`r-${seg.item.label}`}
            d={ribbonPath(TX + TW, rTrunk[index].y0, rTrunk[index].y1, RX, seg.y0, seg.y1)}
            fill={seg.item.color}
            opacity="0.45"
          >
            <title>{`${seg.item.label} · ${formatMoney(seg.item.value, currency)}`}</title>
          </path>
        ))}

        {/* Nodos */}
        {lSegs.map((seg) => (
          <rect
            key={`ln-${seg.item.label}`}
            x={LX}
            y={seg.y0}
            width="10"
            height={seg.y1 - seg.y0}
            rx="4"
            fill={seg.item.color}
          />
        ))}
        <rect x={TX} y={TOP} width={TW} height={PLOT} rx="7" fill="var(--color-verde)" opacity="0.9" />
        {rSegs.map((seg) => (
          <rect
            key={`rn-${seg.item.label}`}
            x={RX}
            y={seg.y0}
            width="10"
            height={seg.y1 - seg.y0}
            rx="4"
            fill={seg.item.color}
          />
        ))}

        {/* Etiquetas */}
        <text x={TX + TW / 2} y={TOP - 10} textAnchor="middle" className={style.flowTrunkLabel}>
          100%
        </text>
        {lSegs.map((seg) => {
          const mid = (seg.y0 + seg.y1) / 2;
          const pct = ((seg.item.value / totalLeft) * 100).toFixed(0);
          return (
            <g key={`lt-${seg.item.label}`}>
              <text x={LX - 8} y={mid - 2} textAnchor="end" className={style.flowLabel}>
                {truncLabel(seg.item.label)}
              </text>
              <text x={LX - 8} y={mid + 12} textAnchor="end" className={style.flowMoney}>
                {formatMoney(seg.item.value, currency)} · {pct}%
              </text>
            </g>
          );
        })}
        {rSegs.map((seg) => {
          const mid = (seg.y0 + seg.y1) / 2;
          const pct = ((seg.item.value / totalRight) * 100).toFixed(0);
          return (
            <g key={`rt-${seg.item.label}`}>
              <text x={RX + 18} y={mid - 2} className={style.flowLabel}>
                {truncLabel(seg.item.label)}
              </text>
              <text x={RX + 18} y={mid + 12} className={style.flowMoney}>
                {formatMoney(seg.item.value, currency)} · {pct}%
              </text>
            </g>
          );
        })}
      </svg>
      <div className={style.flowFootRow}>
        <span>← De dónde entró</span>
        <span>A dónde fue →</span>
      </div>
    </div>
  );
};

// Donut real (conic-gradient) + leyenda con monto y porcentaje de cada porción
const DonutCard = ({ title, subtitle, items, emptyLabel, currency, centerTitle, centerSub }) => {
  const shown = items.filter((item) => item.value > 0);
  const total = shown.reduce((acc, item) => acc + item.value, 0);

  return (
    <article className={style.chartCard}>
      <div className={style.chartHeader}>
        <div>
          <span className={style.kicker}>{title}</span>
          <h2>{subtitle}</h2>
        </div>
        <strong>{total ? "100%" : "0%"}</strong>
      </div>

      {total ? (
        <div className={style.donutLayout}>
          <div
            className={style.donut}
            style={{ background: buildConicGradient(shown) }}
            aria-label={subtitle}
          >
            <div>
              <strong>{centerTitle ?? shown.length}</strong>
              <span>{centerSub ?? "rubros"}</span>
            </div>
          </div>
          <div className={style.legend}>
            {shown.map((item) => (
              <div key={item.label} className={style.legendItem}>
                <i style={{ background: item.color }} />
                <span>{item.label}</span>
                <strong>
                  {formatMoney(item.value, currency)}
                  <em className={style.legendPct}>
                    {((item.value / total) * 100).toFixed(1)}%
                  </em>
                </strong>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className={style.emptyText}>{emptyLabel}</p>
      )}
    </article>
  );
};

function MetricsPage({
  movimientos = [],
  currentCurrency,
  onCurrencyChange,
}) {
  const [period, setPeriod] = useState("month");
  const [selectedMonth, setSelectedMonth] = useState(getMonthInputValue(new Date()));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  // Ranking: compara categorías entre sí dentro del período (egresos o ingresos)
  const [rankingType, setRankingType] = useState("egreso");
  const currency = normalizeCurrency(currentCurrency);

  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear()]);

    movimientos.forEach((movimiento) => {
      const date = new Date(movimiento.fecha);
      if (!Number.isNaN(date.getTime())) {
        years.add(date.getFullYear());
      }
    });

    return [...years].sort((a, b) => b - a);
  }, [movimientos]);

  const range = useMemo(
    () => getPeriodRange(period, selectedMonth, selectedYear),
    [period, selectedMonth, selectedYear]
  );

  const periodMovimientos = useMemo(
    () =>
      filterMovimientosByCurrency(movimientos, currency, {
        from: range.from,
        to: range.to,
      }),
    [movimientos, currency, range.from, range.to]
  );

  const summary = useMemo(() => summarizeByType(periodMovimientos), [periodMovimientos]);

  const typeItems = useMemo(
    () => [
      { label: "Ingresos", value: summary.ingreso, color: TYPE_COLORS.ingreso },
      { label: "Egresos", value: summary.egreso, color: TYPE_COLORS.egreso },
      { label: "Ahorros", value: summary.ahorro, color: TYPE_COLORS.ahorro },
      {
        label: "Deuda pendiente",
        value: summary.deudaPendiente,
        color: TYPE_COLORS.deuda,
      },
    ],
    [summary]
  );

  const expenseCategoryItems = useMemo(() => {
    const buckets = periodMovimientos.reduce((acc, movimiento) => {
      if (movimiento.tipo !== "egreso") return acc;
      const category = movimiento.categoria?.trim() || "Sin categoria";
      acc[category] = (acc[category] || 0) + (Number(movimiento.monto) || 0);
      return acc;
    }, {});

    return Object.entries(buckets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value], index) => ({
        label,
        value: Number(value.toFixed(2)),
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }));
  }, [periodMovimientos]);

  const incomeCategoryItems = useMemo(() => {
    const buckets = periodMovimientos.reduce((acc, movimiento) => {
      if (movimiento.tipo !== "ingreso") return acc;
      const category = movimiento.categoria?.trim() || "Sin categoria";
      acc[category] = (acc[category] || 0) + (Number(movimiento.monto) || 0);
      return acc;
    }, {});

    return Object.entries(buckets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value], index) => ({
        label,
        value: Number(value.toFixed(2)),
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }));
  }, [periodMovimientos]);

  // Datos del ranking según el toggle. El % se calcula contra el total real del
  // tipo en el período (no solo contra el top 8), para no mentir.
  const rankingItems = rankingType === "egreso" ? expenseCategoryItems : incomeCategoryItems;
  const rankingTotal = rankingType === "egreso" ? summary.egreso : summary.ingreso;
  const rankingMax = rankingItems[0]?.value || 1;

  // Destinos del flujo (sankey): gastos por categoría + ahorro + lo que quedó
  const flowRightItems = useMemo(() => {
    const items = expenseCategoryItems.slice(0, 4).map((item) => ({ ...item }));
    if (summary.ahorro > 0) {
      items.push({ label: "Ahorro", value: summary.ahorro, color: "#58eba4" });
    }
    const disponible = summary.ingreso - summary.egreso - summary.ahorro;
    if (disponible > 0) {
      items.push({ label: "Disponible", value: Number(disponible.toFixed(2)), color: "#69a7ff" });
    }
    return items;
  }, [expenseCategoryItems, summary]);

  const monthlyBuckets = useMemo(
    () => buildMonthlyBuckets(periodMovimientos, range.from, range.to),
    [periodMovimientos, range.from, range.to]
  );
  const maxMonthlyAmount = Math.max(
    1,
    ...monthlyBuckets.flatMap((bucket) => [
      bucket.ingreso,
      bucket.egreso,
      bucket.ahorro,
    ])
  );
  const totalTypeAmount = typeItems.reduce((acc, item) => acc + item.value, 0);

  return (
    <section className={style.container}>
      {/* Cabecera limpia estilo mockup: título grande + "Periodo activo" con
          desplegables inline, y el switch de moneda arriba a la derecha. */}
      <header className={style.pageHead}>
        <div>
          <h1 className={style.pageTitle}>Métricas</h1>
          <div className={style.periodRow}>
            <span>Periodo activo:</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value)}>
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {period === "year" ? (
              <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
              />
            )}
          </div>
        </div>

        <div
          className={`${style.currencySwitch} ${
            currency === "USD" ? style.currencySwitchUsd : style.currencySwitchArs
          }`}
        >
          {CURRENCY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${style.currencyButton} ${
                currency === option.value ? style.currencyButtonActive : ""
              }`}
              onClick={() => onCurrencyChange?.(option.value)}
            >
              {option.codeLabel}
            </button>
          ))}
        </div>
      </header>

      <div className={style.summaryGrid}>
        <article className={style.statCard}>
          <div className={style.statHead}>
            <span>Balance</span>
            <i className={style.statIcon} style={{ background: "rgba(105, 167, 255, 0.16)", color: "#69a7ff" }}>
              <FiActivity />
            </i>
          </div>
          <strong>{formatMoney(summary.total, currency)}</strong>
          <p>Ingresos menos egresos y ahorro.</p>
        </article>
        <article className={style.statCard}>
          <div className={style.statHead}>
            <span>Ingresos</span>
            <i className={style.statIcon} style={{ background: "rgba(156, 251, 67, 0.16)", color: "#9cfb43" }}>
              <FiTrendingUp />
            </i>
          </div>
          <strong>{formatMoney(summary.ingreso, currency)}</strong>
          <p>{totalTypeAmount ? ((summary.ingreso / totalTypeAmount) * 100).toFixed(1) : 0}% del flujo.</p>
        </article>
        <article className={style.statCard}>
          <div className={style.statHead}>
            <span>Egresos</span>
            <i className={style.statIcon} style={{ background: "rgba(255, 145, 92, 0.16)", color: "#ff915c" }}>
              <FiTrendingDown />
            </i>
          </div>
          <strong>{formatMoney(summary.egreso, currency)}</strong>
          <p>{periodMovimientos.filter((item) => item.tipo === "egreso").length} movimientos.</p>
        </article>
        <article className={style.statCard}>
          <div className={style.statHead}>
            <span>Deuda pendiente</span>
            <i className={style.statIcon} style={{ background: "rgba(255, 213, 92, 0.16)", color: "#ffd55c" }}>
              <FiClock />
            </i>
          </div>
          <strong>{formatMoney(summary.deudaPendiente, currency)}</strong>
          <p>{summary.deudaPendienteCount || 0} registros abiertos.</p>
        </article>
      </div>

      {/* Composición por TIPO (vista general) + zoom por CATEGORÍA de los gastos.
          Los ingresos por categoría viven en el toggle del Ranking. */}
      <div className={style.chartGrid}>
        <DonutCard
          title="Composición"
          subtitle="Ingresos, gastos, ahorro y deuda"
          items={typeItems}
          currency={currency}
          centerSub="tipos"
          emptyLabel="No hay movimientos en este corte."
        />

        <article className={style.chartCard}>
          <div className={style.chartHeader}>
            <div>
              <span className={style.kicker}>Composición</span>
              <h2>Composición total y categorías</h2>
            </div>
            <strong>100%</strong>
          </div>
          <FlowChart
            leftItems={incomeCategoryItems}
            rightItems={flowRightItems}
            currency={currency}
          />
        </article>
      </div>

      <section className={style.timelineCard}>
        <div className={style.chartHeader}>
          <div>
            <span className={style.kicker}>Evolución</span>
            <h2>Comparación mensual</h2>
          </div>
          <p>Vela por mes: verde si cerró positivo (ingresos &gt; egresos), roja si negativo.</p>
        </div>

        <div className={style.candleChart}>
          {monthlyBuckets.length ? (
            <div className={style.candleScroll}>
              {(() => {
                const COL = 46; // ancho de columna por vela (px)
                const BODY = 18; // ancho del cuerpo
                const TOP = 12;
                const PLOT = 186; // alto del área de ploteo
                const H = 236;
                const W = monthlyBuckets.length * COL;
                const max = (maxMonthlyAmount || 1) * 1.15; // headroom para que no toque los bordes
                const yVal = (v) => TOP + PLOT * (1 - v / max);
                return (
                  <svg
                    className={style.candleSvg}
                    width={W}
                    height={H}
                    viewBox={`0 0 ${W} ${H}`}
                    role="img"
                  >
                    {/* Grilla horizontal */}
                    {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                      <line
                        key={t}
                        x1="0"
                        x2={W}
                        y1={TOP + PLOT * t}
                        y2={TOP + PLOT * t}
                        stroke="var(--border-color)"
                        strokeWidth="1"
                        opacity="0.4"
                      />
                    ))}
                    {/* Velas */}
                    {monthlyBuckets.map((bucket, i) => {
                      const open = bucket.egreso;
                      const close = bucket.ingreso;
                      const high = Math.max(bucket.ingreso, bucket.egreso, bucket.ahorro);
                      const low = Math.min(bucket.ingreso, bucket.egreso, bucket.ahorro, 0);
                      const up = close >= open;
                      const color = up ? TYPE_COLORS.ingreso : TYPE_COLORS.egreso;
                      const cx = i * COL + COL / 2;
                      const bodyTop = yVal(Math.max(open, close));
                      const bodyH = Math.max(3, yVal(Math.min(open, close)) - bodyTop);
                      return (
                        <g key={bucket.key}>
                          <title>
                            {`${bucket.label} · Ingresos ${formatMoney(bucket.ingreso, currency)} · Egresos ${formatMoney(bucket.egreso, currency)} · Ahorro ${formatMoney(bucket.ahorro, currency)}`}
                          </title>
                          {/* Mecha */}
                          <line
                            x1={cx}
                            x2={cx}
                            y1={yVal(high)}
                            y2={yVal(low)}
                            stroke={color}
                            strokeWidth="2"
                          />
                          {/* Cuerpo */}
                          <rect
                            x={cx - BODY / 2}
                            y={bodyTop}
                            width={BODY}
                            height={bodyH}
                            rx="3"
                            fill={color}
                          />
                          {/* Etiqueta del mes */}
                          <text x={cx} y={H - 7} textAnchor="middle" className={style.candleLabelText}>
                            {bucket.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          ) : (
            <p className={style.candleEmpty}>Sin datos para graficar en este período.</p>
          )}
        </div>

        <div className={style.chartLegendRow}>
          <span>
            <i style={{ background: TYPE_COLORS.ingreso }} />
            Mes positivo
          </span>
          <span>
            <i style={{ background: TYPE_COLORS.egreso }} />
            Mes negativo
          </span>
        </div>
      </section>

      {/* Ranking: categorías comparadas entre sí dentro del período activo,
          en barras horizontales ordenadas de mayor a menor. */}
      <section className={style.categoryPanel}>
        <div className={style.chartHeader}>
          <div>
            <span className={style.kicker}>Ranking</span>
            <h2>
              {rankingType === "egreso"
                ? "¿En qué se fue la plata?"
                : "¿De dónde entró la plata?"}
            </h2>
          </div>
          <div className={style.rankSwitch}>
            {[
              ["egreso", "Egresos"],
              ["ingreso", "Ingresos"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`${style.rankSwitchBtn} ${
                  rankingType === value ? style.rankSwitchOn : ""
                }`}
                onClick={() => setRankingType(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {rankingItems.length ? (
          <div className={style.rankSplit}>
            {/* Leyenda a la izquierda, como el mockup */}
            <div className={style.rankLegend}>
              {rankingItems.map((item) => (
                <div key={item.label} className={style.legendItem}>
                  <i style={{ background: item.color }} />
                  <span>{item.label}</span>
                  <strong>{formatMoney(item.value, currency)}</strong>
                </div>
              ))}
            </div>

            {/* Barras verticales ordenadas de mayor a menor */}
            <div className={style.rankChartWrap}>
              {(() => {
                const COL = 72;
                const AXIS = 52;
                const TOP = 20;
                const PLOT = 180;
                const H = 240;
                const max = rankingMax * 1.12;
                const W = AXIS + rankingItems.length * COL;
                const yFor = (value) => TOP + PLOT * (1 - value / max);
                return (
                  <svg
                    className={style.rankSvg}
                    width={W}
                    height={H}
                    viewBox={`0 0 ${W} ${H}`}
                    role="img"
                  >
                    {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                      <g key={t}>
                        <line
                          x1={AXIS}
                          x2={W}
                          y1={TOP + PLOT * t}
                          y2={TOP + PLOT * t}
                          stroke="var(--border-color)"
                          strokeWidth="1"
                          opacity="0.4"
                        />
                        <text
                          x={AXIS - 7}
                          y={TOP + PLOT * t + 4}
                          textAnchor="end"
                          className={style.rankAxisText}
                        >
                          {compactMoney(max * (1 - t))}
                        </text>
                      </g>
                    ))}
                    {rankingItems.map((item, index) => {
                      const cx = AXIS + index * COL + COL / 2;
                      const top = yFor(item.value);
                      const pct = rankingTotal
                        ? ((item.value / rankingTotal) * 100).toFixed(1)
                        : 0;
                      return (
                        <g key={item.label}>
                          <title>
                            {`${item.label} · ${formatMoney(item.value, currency)} · ${pct}%`}
                          </title>
                          <rect
                            x={cx - 17}
                            y={top}
                            width="34"
                            height={Math.max(3, TOP + PLOT - top)}
                            rx="6"
                            fill={item.color}
                          />
                          <text x={cx} y={top - 7} textAnchor="middle" className={style.rankPctText}>
                            {pct}%
                          </text>
                          <text x={cx} y={H - 6} textAnchor="middle" className={style.rankAxisText}>
                            {truncLabel(item.label, 10)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          </div>
        ) : (
          <p className={style.emptyText}>
            No hay {rankingType === "egreso" ? "egresos" : "ingresos"} en este período.
          </p>
        )}
      </section>
    </section>
  );
}

export default MetricsPage;
