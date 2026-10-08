import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Add from "./Add";
import { FiX } from "react-icons/fi";
import style from "../style/App.module.css";
import MovementCard from "./MovementCard";
import {
  filterMovimientosByCurrency,
  getCurrencyMeta,
} from "../utils/finance";

const DASHBOARD_PERIODS = [
  { value: "day", label: "Hoy" },
  { value: "month", label: "Mensual" },
  { value: "year", label: "Anual" },
];

const getPeriodRange = (period) => {
  const now = new Date();

  if (period === "year") {
    return {
      from: new Date(now.getFullYear(), 0, 1),
      to: new Date(now.getFullYear(), 11, 31),
    };
  }

  if (period === "month") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  }

  return {
    from: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    to: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
  };
};

const getLocalDayKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

const getLocalMonthKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const formatDashboardGroupLabel = (value, period) => {
  const date = new Date(value);

  if (period === "year") {
    return `Mes · ${date.toLocaleDateString("es-AR", {
      month: "long",
      year: "numeric",
    })}`;
  }

  return `Día · ${date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })}`;
};

const groupMovimientosForDashboard = (items, period) => {
  const grouped = items.reduce((accumulator, movimiento) => {
    const key =
      period === "year"
        ? getLocalMonthKey(movimiento.fecha)
        : getLocalDayKey(movimiento.fecha);

    if (!accumulator.has(key)) {
      accumulator.set(key, []);
    }

    accumulator.get(key).push(movimiento);
    return accumulator;
  }, new Map());

  return [...grouped.entries()].map(([key, movimientosDelGrupo]) => ({
    key,
    label: formatDashboardGroupLabel(movimientosDelGrupo[0]?.fecha, period),
    movimientos: movimientosDelGrupo,
  }));
};

function Dashboard({
  movimientos = [],
  refreshKey,
  onMovementUpdate,
  movementToEdit,
  setMovementToEdit,
  currentCurrency,
  onCurrencyChange,
  ...authProps
}) {
  const navigate = useNavigate();
  const [showOnly, setShowOnly] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("day");

  const periodRange = useMemo(
    () => getPeriodRange(selectedPeriod),
    [selectedPeriod],
  );
  const scopedMovimientos = useMemo(
    () =>
      filterMovimientosByCurrency(movimientos, currentCurrency, {
        from: periodRange.from,
        to: periodRange.to,
      }).sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
      ),
    [movimientos, currentCurrency, periodRange.from, periodRange.to],
  );
  const groupedScopedMovimientos = useMemo(
    () => groupMovimientosForDashboard(scopedMovimientos, selectedPeriod),
    [scopedMovimientos, selectedPeriod],
  );

  const currencyMeta = getCurrencyMeta(currentCurrency);

  return (
    <div className={`${style.page} ${style.homeViewport}`}>
      <section className={style.contentLayout}>
        <section className={style.dashboardInfoCard}>
          <div className={style.dashboardInfoHeader}>
            <div>
              <p className={style.eyebrow}>Panel de movimientos</p>
            </div>
            <span className={style.dashboardInfoBadge}>
              {currencyMeta.codeLabel}
            </span>
          </div>

          <div className={style.dashboardPeriodRow}>
            <div className={style.dashboardPeriodSwitch}>
              {DASHBOARD_PERIODS.map((period) => (
                <button
                  key={period.value}
                  type="button"
                  className={`${style.dashboardPeriodButton} ${selectedPeriod === period.value
                    ? style.dashboardPeriodButtonActive
                    : ""
                    }`}
                  onClick={() => setSelectedPeriod(period.value)}
                >
                  {period.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={style.dashboardAddBtn}
              onClick={() => navigate("/add")}
            >
              + Cargar movimiento
            </button>
          </div>

          <div className={style.dashboardMovementShell}>
            {scopedMovimientos.length === 0 ? (
              <div className={style.dashboardEmptyState}>
                <h3>No hay movimientos para mostrar</h3>
                <p>
                  Cambiá a otra vista o cargá un movimiento para verlo también
                  desde el home.
                </p>
              </div>
            ) : (
              <div className={style.dashboardMovementList}>
                {groupedScopedMovimientos.map((group) => (
                  <section
                    key={group.key}
                    className={style.dashboardMovementGroup}
                  >
                    <div className={style.dashboardMovementGroupHeader}>
                      <span>{group.label}</span>
                    </div>

                    <div className={style.dashboardMovementGroupRows}>
                      {group.movimientos.map((movimiento) => (
                        <MovementCard
                          key={movimiento._id}
                          movimiento={movimiento}
                          currentCurrency={currentCurrency}
                          onEditMovement={setMovementToEdit}
                          onMovementUpdate={onMovementUpdate}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

        </section>

      </section>

      {showOnly && (
        <section
          className={style.modalOverlay}
          onClick={() => {
            setShowOnly(null);
            setMovementToEdit?.(null);
          }}
        >
          <div
            className={style.inlineForm}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={style.inlineFormHeader}>
              <div>
                <p className={style.inlineFormEyebrow}>Cargar movimiento</p>

              </div>

              <button
                type="button"
                className={style.closeInlineForm}
                onClick={() => {
                  setShowOnly(null);
                  setMovementToEdit?.(null);
                }}
                aria-label="Cerrar formulario"
              >
                <FiX />
              </button>
            </div>

            <Add
              onMovementAdded={(savedMovement) => {
                onMovementUpdate?.(savedMovement);
                setShowOnly(null);
                setMovementToEdit?.(null);
              }}
              onNeedSavings={() => {
                setMovementToEdit?.(null);
                setShowOnly("ahorro");
              }}
              movementToEdit={movementToEdit}
              only={showOnly === "all" ? undefined : showOnly}
              defaultCurrency={currentCurrency}
              inModal
            />
          </div>
        </section>
      )}
    </div>
  );
}

export default Dashboard;
