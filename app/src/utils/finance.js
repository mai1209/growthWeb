// Subconjunto de la lógica financiera de la web, portado a la app.
export const DEFAULT_CURRENCY = "ARS";

export const CURRENCY_OPTIONS = [
  { value: "ARS", label: "Pesos", codeLabel: "ARS", symbol: "$" },
  { value: "USD", label: "Dolares", codeLabel: "USD", symbol: "US$" },
];

export const normalizeCurrency = (currency) =>
  currency === "USD" ? "USD" : DEFAULT_CURRENCY;

export const normalizeMovementType = (type) =>
  ["ingreso", "egreso", "ahorro", "deuda"].includes(type) ? type : "egreso";

export const getCurrencyMeta = (currency) =>
  CURRENCY_OPTIONS.find((o) => o.value === normalizeCurrency(currency)) ||
  CURRENCY_OPTIONS[0];

export const formatMoney = (amount, currency = DEFAULT_CURRENCY, options = {}) => {
  const meta = getCurrencyMeta(currency);
  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(Number(amount) || 0);
  return `${meta.symbol} ${formatted}`;
};

export const isSameMonth = (value, referenceDate = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth()
  );
};

export const filterMovimientosByCurrency = (movimientos = [], currency, range = null) => {
  const safe = Array.isArray(movimientos) ? movimientos : [];
  const safeCurrency = normalizeCurrency(currency);
  const fromTime = range?.from ? new Date(range.from).setHours(0, 0, 0, 0) : null;
  const toTime = range?.to ? new Date(range.to).setHours(23, 59, 59, 999) : null;

  return safe.filter((m) => {
    if (normalizeCurrency(m?.currency || m?.moneda) !== safeCurrency) return false;
    if (fromTime !== null || toTime !== null) {
      const t = new Date(m?.fecha).getTime();
      if (Number.isNaN(t)) return false;
      if (fromTime !== null && t < fromTime) return false;
      if (toTime !== null && t > toTime) return false;
    }
    return true;
  });
};

export const MOVEMENT_TYPE_OPTIONS = [
  { value: "ingreso", label: "Ingreso" },
  { value: "egreso", label: "Egreso" },
  { value: "ahorro", label: "Ahorro" },
  { value: "deuda", label: "Deuda" },
];

// Color + signo por tipo (alineado a la web)
export const getMovementTypeMeta = (type) => {
  const t = normalizeMovementType(type);
  if (t === "ingreso") return { label: "Ingreso", sign: "+", color: "#2fa56f" };
  if (t === "ahorro") return { label: "Ahorro", sign: "-", color: "#2bb888" };
  if (t === "deuda") return { label: "Deuda", sign: null, color: "#d6a92e" };
  return { label: "Egreso", sign: "-", color: "#e0654f" };
};

export const formatSignedMoney = (amount, currency, type) => {
  const meta = getMovementTypeMeta(type);
  const base = formatMoney(amount, currency);
  return meta.sign ? `${meta.sign} ${base}` : base;
};

export const getDayKey = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const formatDayLabel = (value) =>
  new Date(value).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
  });

export const summarizeByType = (movimientos = []) =>
  movimientos.reduce(
    (acc, m) => {
      const amount = Number(m.monto) || 0;
      const type = normalizeMovementType(m.tipo);

      if (type === "ingreso") acc.ingreso += amount;
      else if (type === "ahorro") acc.ahorro += amount;
      else if (type === "deuda") {
        if (m.deudaEstado === "pagada") acc.deudaPagada += amount;
        else {
          acc.deudaPendiente += amount;
          acc.deudaPendienteCount += 1;
        }
      } else if (m.desdeAhorro) {
        // "Usar ahorro": sale del ahorro acumulado, no del saldo
        acc.ahorroUsado += amount;
      } else acc.egreso += amount;

      acc.total = acc.ingreso - acc.egreso - acc.ahorro;
      acc.ahorroDisponible = acc.ahorro - acc.ahorroUsado;
      return acc;
    },
    {
      ingreso: 0,
      egreso: 0,
      ahorro: 0,
      ahorroUsado: 0,
      ahorroDisponible: 0,
      deudaPendiente: 0,
      deudaPendienteCount: 0,
      deudaPagada: 0,
      total: 0,
    }
  );
