// Métricas — formato del mockup "lila" pero con la paleta actual de la app:
// KPIs con chip de ícono · Composición en barras horizontales con % ·
// Ingresos/Gastos por categoría como anillos (100% al centro, categoría
// principal abajo) · Evolución como línea suave con puntos verde/rojo ·
// Ranking como lista numerada.
import { useMemo, useState } from "react";
import { FiActivity, FiClock, FiTrendingDown, FiTrendingUp } from "react-icons/fi";
import style from "../style/Metrics.module.css";
import {
  CURRENCY_OPTIONS,
  filterMovimientosByCurrency,
  formatMoney,
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
    balance: Number((bucket.ingreso - bucket.egreso).toFixed(2)),
  }));
};

// Anillo por categorías: 100% al centro y la categoría principal debajo (mockup)
const RingCard = ({ title, subtitle, items, emptyLabel }) => {
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
        <div className={style.ringWrap}>
          <div
            className={style.ring}
            style={{ background: buildConicGradient(shown) }}
            title={shown
              .map((item) => `${item.label} ${((item.value / total) * 100).toFixed(1)}%`)
              .join(" · ")}
          >
            <div className={style.ringHole}>100%</div>
          </div>
          <p className={style.ringTopCat}>{shown[0].label}</p>
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

  const buildCategoryItems = (tipo) => {
    const buckets = periodMovimientos.reduce((acc, movimiento) => {
      if (movimiento.tipo !== tipo) return acc;
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
  };

  const expenseCategoryItems = useMemo(
    () => buildCategoryItems("egreso"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodMovimientos]
  );
  const incomeCategoryItems = useMemo(
    () => buildCategoryItems("ingreso"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodMovimientos]
  );

  // Evolución DIARIA del balance dentro del período: siempre hay una línea
  // completa a lo ancho (con un solo mes, "por mes" era un punto flotando).
  const dailySeries = useMemo(() => {
    const byDay = new Map();
    periodMovimientos.forEach((movimiento) => {
      let delta = 0;
      if (movimiento.tipo === "ingreso") delta = Number(movimiento.monto) || 0;
      else if (movimiento.tipo === "egreso" || movimiento.tipo === "ahorro")
        delta = -(Number(movimiento.monto) || 0);
      else return;
      const key = String(movimiento.fecha).slice(0, 10);
      byDay.set(key, (byDay.get(key) || 0) + delta);
    });

    const today = new Date();
    const end = range.to < today ? range.to : today;
    const days = [];
    let acc = 0;
    const cursor = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate());
    while (cursor <= end && days.length < 400) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const delta = byDay.get(key) || 0;
      acc += delta;
      days.push({
        key,
        label: cursor.toLocaleDateString("es-AR", { day: "numeric", month: "short" }),
        balance: Number(acc.toFixed(2)),
        delta,
        hasMov: byDay.has(key),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [periodMovimientos, range.from, range.to]);

  const rankingItems = rankingType === "egreso" ? expenseCategoryItems : incomeCategoryItems;
  const rankingTotal = rankingType === "egreso" ? summary.egreso : summary.ingreso;

  const totalTypeAmount = typeItems.reduce((acc, item) => acc + item.value, 0);
  const compositionItems = typeItems.filter((item) => item.value > 0);

  return (
    <section className={style.container}>
      {/* Cabecera: título grande + "Periodo activo" inline + switch de moneda */}
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

      {/* Panel ÚNICO: KPIs + composición/anillos + evolución/ranking, todo
          sobre el mismo fondo con líneas divisorias */}
      <div className={style.unifiedPanel}>
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

      <div className={style.trioGrid}>
        <article className={style.chartCard}>
          <div className={style.chartHeader}>
            <div>
              <span className={style.kicker}>Composición</span>
              <h2>Ingresos, gastos, ahorro y deuda</h2>
            </div>
            <strong>{compositionItems.length ? "100%" : "0%"}</strong>
          </div>

          {compositionItems.length ? (
            <div className={style.compList}>
              {compositionItems.map((item) => {
                const pct = ((item.value / totalTypeAmount) * 100).toFixed(1);
                return (
                  <div key={item.label} className={style.compRow} title={formatMoney(item.value, currency)}>
                    <span className={style.compLabel}>{item.label}</span>
                    <div className={style.compBarLine}>
                      <div className={style.compTrack}>
                        <div
                          className={style.compFill}
                          style={{ width: `${pct}%`, background: item.color, color: item.color }}
                        />
                      </div>
                      <strong className={style.compPct}>{pct}%</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={style.emptyText}>No hay movimientos en este corte.</p>
          )}
        </article>

        <RingCard
          title="Ingresos por categoría"
          subtitle="De dónde entró la plata"
          items={incomeCategoryItems}
          emptyLabel="No hay ingresos para graficar."
        />

        <RingCard
          title="Gastos por categoría"
          subtitle="Dónde se fue la plata"
          items={expenseCategoryItems}
          emptyLabel="No hay egresos para graficar."
        />
      </div>

      {/* Banda inferior del mockup: línea de evolución + ranking en lista */}
      <div className={style.bottomGrid}>
        <section className={style.timelineCard}>
          <div className={style.chartHeader}>
            <div>
              <span className={style.kicker}>Evolución</span>
              <h2>Cómo se movió tu saldo en el período</h2>
            </div>
          </div>

          {dailySeries.length > 1 ? (
            <>
              <div className={style.lineChartWrap}>
                {(() => {
                  const W = 560;
                  const H = 210;
                  const PADX = 26;
                  const TOP = 34;
                  const BOT = 34;
                  const series = dailySeries;
                  const vals = series.map((d) => d.balance);
                  const maxV = Math.max(...vals, 0);
                  const minV = Math.min(...vals, 0);
                  const span = maxV - minV || 1;
                  const plot = H - TOP - BOT;
                  const xFor = (i) => PADX + ((W - PADX * 2) * i) / (series.length - 1);
                  const yFor = (v) => TOP + plot * (1 - (v - minV) / span);
                  const pts = series.map((d, i) => ({ x: xFor(i), y: yFor(d.balance), d }));
                  // Línea suave: curvas horizontales entre punto y punto
                  const path = pts
                    .map((p, i) => {
                      if (i === 0) return `M ${p.x} ${p.y}`;
                      const prev = pts[i - 1];
                      const mx = (prev.x + p.x) / 2;
                      return `C ${mx} ${prev.y}, ${mx} ${p.y}, ${p.x} ${p.y}`;
                    })
                    .join(" ");
                  const movPts = pts.filter((p) => p.d.hasMov);
                  const showDots = movPts.length > 0 && movPts.length <= 40;
                  const last = pts[pts.length - 1];
                  const tagW = 84;
                  const tagX = Math.min(W - tagW - 4, Math.max(4, last.x - tagW / 2));
                  const tagY = last.y - 34 < 4 ? last.y + 12 : last.y - 34;
                  // 4 fechas de referencia en el eje
                  const axisIdx = [...new Set([0, Math.round((series.length - 1) / 3), Math.round(((series.length - 1) * 2) / 3), series.length - 1])];
                  return (
                    <svg className={style.lineSvg} viewBox={`0 0 ${W} ${H}`} role="img">
                      {/* Línea de cero, de referencia */}
                      <line
                        x1={PADX}
                        x2={W - PADX}
                        y1={yFor(0)}
                        y2={yFor(0)}
                        stroke="var(--border-color)"
                        strokeDasharray="4 5"
                        opacity="0.7"
                      />
                      <path d={path} fill="none" stroke="var(--color-verde)" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
                      {showDots
                        ? movPts.map((p) => (
                            <g key={p.d.key}>
                              <title>
                                {`${p.d.label} · Saldo ${formatMoney(p.d.balance, currency)} · Movimiento del día ${formatMoney(p.d.delta, currency)}`}
                              </title>
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r="6"
                                fill={p.d.delta >= 0 ? TYPE_COLORS.ingreso : "#ff6e6e"}
                                stroke="var(--surface-card-strong)"
                                strokeWidth="2.5"
                              />
                            </g>
                          ))
                        : null}
                      {/* Tag del último día, como en el mockup */}
                      <g>
                        <rect x={tagX} y={tagY} width={tagW} height="22" rx="8" className={style.lineTag} />
                        <text x={tagX + tagW / 2} y={tagY + 15} textAnchor="middle" className={style.lineTagText}>
                          {last.d.label}
                        </text>
                      </g>
                      {/* Fechas de referencia en el eje */}
                      {axisIdx.map((i) => (
                        <text key={`x-${pts[i].d.key}`} x={pts[i].x} y={H - 8} textAnchor="middle" className={style.lineAxisText}>
                          {pts[i].d.label}
                        </text>
                      ))}
                    </svg>
                  );
                })()}
              </div>
              <div className={style.chartLegendRow}>
                <span>
                  <i style={{ background: TYPE_COLORS.ingreso }} />
                  Día con saldo a favor
                </span>
                <span>
                  <i style={{ background: "#ff6e6e" }} />
                  Día con más gastos
                </span>
              </div>
            </>
          ) : (
            <p className={style.emptyText}>Sin datos para graficar en este período.</p>
          )}
        </section>

        <section className={style.categoryPanel}>
          <div className={style.chartHeader}>
            <div>
              <span className={style.kicker}>Ranking</span>
              <h2>
                {rankingType === "egreso"
                  ? "Categorías con mayor egreso"
                  : "Categorías con mayor ingreso"}
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
            <div className={style.rankRows}>
              {rankingItems.map((item, index) => (
                <div key={item.label} className={style.rankItemRow}>
                  <span className={style.rankChip}>{index + 1}</span>
                  <span className={style.rankName}>{item.label}</span>
                  <span className={style.rankAmt}>
                    {formatMoney(item.value, currency)}
                    <em>
                      {rankingTotal ? ((item.value / rankingTotal) * 100).toFixed(1) : 0}%
                    </em>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className={style.emptyText}>
              No hay {rankingType === "egreso" ? "egresos" : "ingresos"} en este período.
            </p>
          )}
        </section>
      </div>
      </div>
    </section>
  );
}

export default MetricsPage;
