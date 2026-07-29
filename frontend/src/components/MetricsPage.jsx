import { useMemo, useState } from "react";
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

const DonutChart = ({ title, subtitle, items, emptyLabel }) => {
  const total = items.reduce((acc, item) => acc + item.value, 0);

  return (
    <article className={style.chartCard}>
      <div className={style.chartHeader}>
        <div>
          <span className={style.kicker}>{title}</span>
          <h2>{subtitle}</h2>
        </div>
        <strong>{total ? "100%" : "0%"}</strong>
      </div>

      <div className={style.donutLayout}>
        <div
          className={style.donut}
          style={{ background: buildConicGradient(items) }}
          aria-label={title}
        >
          <div>
            <strong>{items.filter((item) => item.value > 0).length}</strong>
            <span>rubros</span>
          </div>
        </div>

        {total ? (
          <div className={style.legend}>
            {items
              .filter((item) => item.value > 0)
              .map((item) => (
                <div key={item.label} className={style.legendItem}>
                  <i style={{ background: item.color }} />
                  <span>{item.label}</span>
                  <strong>{((item.value / total) * 100).toFixed(1)}%</strong>
                </div>
              ))}
          </div>
        ) : (
          <p className={style.emptyText}>{emptyLabel}</p>
        )}
      </div>
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
      .slice(0, 6)
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
      .slice(0, 6)
      .map(([label, value], index) => ({
        label,
        value: Number(value.toFixed(2)),
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }));
  }, [periodMovimientos]);

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
      <div className={style.hero}>
        <div>
          <p className={style.kicker}>Métricas</p>
       
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
      </div>

      <div className={style.filters}>
        <label>
          <span>Vista</span>
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {period === "year" ? (
          <label>
            <span>Año</span>
            <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            <span>Mes base</span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            />
          </label>
        )}

        <div className={style.period}>
          <p>Período activo</p>
          <strong>{range.label}</strong>
        </div>
      </div>

      <div className={style.summaryGrid}>
        <article className={style.statCard}>
          <span>Balance</span>
          <strong>{formatMoney(summary.total, currency)}</strong>
          <p>Ingresos menos egresos y ahorro.</p>
        </article>
        <article className={style.statCard}>
          <span>Ingresos</span>
          <strong>{formatMoney(summary.ingreso, currency)}</strong>
          <p>{totalTypeAmount ? ((summary.ingreso / totalTypeAmount) * 100).toFixed(1) : 0}% del flujo.</p>
        </article>
        <article className={style.statCard}>
          <span>Egresos</span>
          <strong>{formatMoney(summary.egreso, currency)}</strong>
          <p>{periodMovimientos.filter((item) => item.tipo === "egreso").length} movimientos.</p>
        </article>
        <article className={style.statCard}>
          <span>Deuda pendiente</span>
          <strong>{formatMoney(summary.deudaPendiente, currency)}</strong>
          <p>{summary.deudaPendienteCount || 0} registros abiertos.</p>
        </article>
      </div>

      <div className={style.chartGrid}>
        <DonutChart
          title="Composición"
          subtitle="Ingresos, gastos, ahorro y deuda"
          items={typeItems}
          emptyLabel="No hay movimientos en este corte."
        />

        <DonutChart
          title="Ingresos por categoría"
          subtitle="De dónde entró la plata"
          items={incomeCategoryItems}
          emptyLabel="No hay ingresos para graficar."
        />

        <DonutChart
          title="Gastos por categoría"
          subtitle="Dónde se fue la plata"
          items={expenseCategoryItems}
          emptyLabel="No hay egresos para graficar."
        />
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

      <section className={style.categoryPanel}>
        <div className={style.chartHeader}>
          <div>
            <span className={style.kicker}>Ranking</span>
            <h2>Categorías con mayor egreso</h2>
          </div>
        </div>

        {expenseCategoryItems.length ? (
          <div className={style.categoryList}>
            {expenseCategoryItems.map((item) => {
              const maxCategory = expenseCategoryItems[0]?.value || 1;
              const percent = (item.value / maxCategory) * 100;

              return (
                <article key={item.label} className={style.categoryRow}>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{getMovementTypeMeta("egreso").label}</span>
                  </div>
                  <div className={style.categoryBarTrack}>
                    <span
                      style={{
                        width: `${Math.max(4, percent)}%`,
                        background: item.color,
                      }}
                    />
                  </div>
                  <strong>{formatMoney(item.value, currency)}</strong>
                </article>
              );
            })}
          </div>
        ) : (
          <p className={style.emptyText}>No hay categorías de egreso en este período.</p>
        )}
      </section>
    </section>
  );
}

export default MetricsPage;
