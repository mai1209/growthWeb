export const DEFAULT_CURRENCY = "ARS";

export const CURRENCY_OPTIONS = [
  { value: "ARS", label: "Pesos", codeLabel: "ARS", symbol: "$" },
  { value: "USD", label: "Dolares", codeLabel: "USD", symbol: "US$" },
];

export const MOVEMENT_TYPE_OPTIONS = [
  { value: "ingreso", label: "Ingreso" },
  { value: "egreso", label: "Egreso" },
  { value: "ahorro", label: "Ahorro" },
];

export const RECURRENCE_OPTIONS = [
  { value: "mensual", label: "Todos los meses" },
  { value: "quincenal", label: "Cada 15 dias" },
  { value: "semanal", label: "Todas las semanas" },
];

export const normalizeCurrency = (currency) =>
  currency === "USD" ? "USD" : DEFAULT_CURRENCY;

export const normalizeMovementType = (type) =>
  ["ingreso", "egreso", "ahorro"].includes(type) ? type : "egreso";

export const getCurrencyMeta = (currency) =>
  CURRENCY_OPTIONS.find((option) => option.value === normalizeCurrency(currency)) ||
  CURRENCY_OPTIONS[0];

export const getMovementTypeMeta = (type) => {
  const normalized = normalizeMovementType(type);

  if (normalized === "ingreso") {
    return { label: "Ingreso", signedAsPositive: true };
  }

  if (normalized === "ahorro") {
    return { label: "Ahorro", signedAsPositive: false };
  }

  return { label: "Egreso", signedAsPositive: false };
};

export const getIsoDate = (value) => {
  if (!value) return "";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getDateOnlyValue = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    const matched = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (matched) {
      return matched[1];
    }
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
};

export const formatMoney = (amount, currency = DEFAULT_CURRENCY, options = {}) => {
  const meta = getCurrencyMeta(currency);
  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(Number(amount) || 0);

  return `${meta.symbol} ${formatted}`;
};

export const formatSignedMoney = (
  amount,
  currency = DEFAULT_CURRENCY,
  positive = true
) => `${positive ? "+" : "-"} ${formatMoney(amount, currency)}`;

export const isSameMonth = (value, referenceDate = new Date()) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth()
  );
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addMonthly = (currentDate, dayOfMonth) => {
  const next = new Date(currentDate);
  next.setDate(1);
  next.setMonth(next.getMonth() + 1);

  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();

  next.setDate(Math.min(dayOfMonth, lastDay));
  return next;
};

const getRecurringStep = (movimiento, currentDate, baseDayOfMonth) => {
  if (movimiento.frecuencia === "mensual") {
    return addMonthly(currentDate, baseDayOfMonth);
  }

  const next = new Date(currentDate);
  const daysToAdd = movimiento.frecuencia === "quincenal" ? 15 : 7;
  next.setDate(next.getDate() + daysToAdd);
  return next;
};

const buildOccurrence = (movimiento, occurrenceDate) => {
  const occurrenceIso = getIsoDate(occurrenceDate);

  return {
    ...movimiento,
    _id: `${movimiento._id}__${occurrenceIso}`,
    fecha: occurrenceIso,
    sourceId: movimiento._id,
    sourceMovimiento: movimiento,
    isVirtualOccurrence: Boolean(movimiento.esRecurrente),
  };
};

export const expandMovimientos = (
  movimientos = [],
  {
    from = null,
    to = new Date(),
    includeNonRecurring = true,
  } = {}
) => {
  const safeFrom = from ? startOfDay(from) : null;
  const safeTo = startOfDay(to);

  return movimientos.flatMap((rawMovimiento) => {
    const movimiento = {
      ...rawMovimiento,
      tipo: normalizeMovementType(rawMovimiento.tipo),
    };

    if (!movimiento.esRecurrente) {
      if (!includeNonRecurring) return [];

      const date = startOfDay(movimiento.fecha);
      if (safeFrom && date < safeFrom) return [];
      if (date > safeTo) return [];
      return [buildOccurrence(movimiento, date)];
    }

    const firstDate = startOfDay(movimiento.fecha);

    if (firstDate > safeTo) {
      return [];
    }

    const baseDayOfMonth = firstDate.getDate();
    const generated = [];
    let current = new Date(firstDate);
    let guard = 0;

    while (current <= safeTo && guard < 500) {
      if (!safeFrom || current >= safeFrom) {
        generated.push(buildOccurrence(movimiento, current));
      }

      current = getRecurringStep(movimiento, current, baseDayOfMonth);
      guard += 1;
    }

    return generated;
  });
};

export const filterMovimientosByCurrency = (
  movimientos = [],
  currency,
  options = {}
) =>
  expandMovimientos(
    movimientos.filter(
      (movimiento) =>
        normalizeCurrency(movimiento.moneda) === normalizeCurrency(currency)
    ),
    options
  );

export const summarizeByType = (movimientos = []) =>
  movimientos.reduce(
    (acc, movimiento) => {
      const amount = Number(movimiento.monto) || 0;
      const type = normalizeMovementType(movimiento.tipo);

      if (type === "ingreso") {
        acc.ingreso += amount;
      } else if (type === "ahorro") {
        acc.ahorro += amount;
      } else {
        acc.egreso += amount;
      }

      acc.total = acc.ingreso - acc.egreso - acc.ahorro;
      return acc;
    },
    { ingreso: 0, egreso: 0, ahorro: 0, total: 0 }
  );

export const getTopCategory = (movimientos = [], tipo = "egreso") => {
  const bucket = movimientos.reduce((acc, movimiento) => {
    if (normalizeMovementType(movimiento.tipo) !== tipo) return acc;

    const categoria = movimiento.categoria?.trim() || "Sin categoria";
    acc[categoria] = (acc[categoria] || 0) + (Number(movimiento.monto) || 0);
    return acc;
  }, {});

  const [categoria, monto] =
    Object.entries(bucket).sort((a, b) => b[1] - a[1])[0] || [];

  return categoria ? { categoria, monto } : null;
};

export const getLatestMovimiento = (movimientos = []) => {
  if (!movimientos.length) return null;

  return [...movimientos].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  )[0];
};

export const getAverageTicket = (movimientos = []) => {
  if (!movimientos.length) return 0;

  const total = movimientos.reduce(
    (acc, movimiento) => acc + (Number(movimiento.monto) || 0),
    0
  );

  return total / movimientos.length;
};
