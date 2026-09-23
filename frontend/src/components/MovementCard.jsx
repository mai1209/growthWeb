import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowDown,
  FiArrowUp,
  FiCreditCard,
  FiDollarSign,
  FiPocket,
  FiRepeat,
  FiSend,
  FiEdit2,
  FiTrash2,
} from "react-icons/fi";
import style from "../style/MonthlyFilters.module.css";
import { ARCA_HABILITADO } from "../featureFlags";
import InputMonto from "./InputMonto";
import { categoriesService, movimientoService } from "../api";
import {
  getDebtStatusMeta,
  formatMoney,
  formatSignedMoney,
  getMovementMethodMeta,
  getMovementTypeMeta,
} from "../utils/finance";

// Ícono por tipo de movimiento (mismo criterio minimalista que la app).
const movementIcon = (m) => {
  if (m.desdeAhorro) return <FiRepeat />;
  if (m.tipo === "ingreso") return <FiArrowDown />;
  if (m.tipo === "ahorro") return <FiPocket />;
  if (m.tipo === "deuda") return <FiCreditCard />;
  return <FiArrowUp />; // egreso
};

// Emojis de las categorías del usuario (nombre en minúscula → emoji). Se piden
// una sola vez y se comparten entre todas las filas.
let categoryIconsPromise = null;
let categoryIconsCache = null;
const loadCategoryIcons = () => {
  if (categoryIconsCache) return Promise.resolve(categoryIconsCache);
  if (!categoryIconsPromise) {
    categoryIconsPromise = categoriesService
      .getAll()
      .then((res) => {
        const map = {};
        (Array.isArray(res.data) ? res.data : []).forEach((c) => {
          if (c?.nombre) map[String(c.nombre).trim().toLowerCase()] = c.icono || "🏷️";
        });
        categoryIconsCache = map;
        return map;
      })
      .catch(() => ({}));
  }
  return categoryIconsPromise;
};

const useCategoryIcon = (nombre) => {
  const [icons, setIcons] = useState(categoryIconsCache);
  useEffect(() => {
    let alive = true;
    loadCategoryIcons().then((map) => {
      if (alive) setIcons(map);
    });
    return () => {
      alive = false;
    };
  }, []);
  return icons?.[String(nombre || "").trim().toLowerCase()] || "🏷️";
};

// Cabecera de columnas de la tabla de movimientos (una sola vez por lista).
export const MovementTableHead = () => (
  <div className={style.tblHead} aria-hidden="true">
    <span>Fecha</span>
    <span>Descripción</span>
    <span>Categoría</span>
    <span>Método</span>
    <span className={style.tblHeadRight}>Monto</span>
    <span />
  </div>
);

const getDayInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * Card de un movimiento. Se usa igual en el Panel de movimientos (Home) y en
 * Filtros, para que se vean y funcionen idénticas (editar, borrar, pagar deuda,
 * emitir factura). Todo el estado del pago/factura vive acá dentro.
 */
export default function MovementCard({
  movimiento,
  currentCurrency,
  onEditMovement,
  onMovementUpdate,
}) {
  const navigate = useNavigate();
  const [facturaBusy, setFacturaBusy] = useState(false);
  const [facturaMsg, setFacturaMsg] = useState(null); // { ok, text }
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleDate, setSettleDate] = useState(getDayInputValue(new Date()));
  const [settleMethod, setSettleMethod] = useState("efectivo");
  const [settleDetail, setSettleDetail] = useState("");
  const [settleMode, setSettleMode] = useState("full"); // full | partial
  const [settleAmount, setSettleAmount] = useState("");
  const [settling, setSettling] = useState(false);

  const categoryIcon = useCategoryIcon(movimiento.categoria);
  const typeMeta = getMovementTypeMeta(movimiento.tipo);
  const methodMeta = getMovementMethodMeta(movimiento.medio);
  const debtStatusMeta = getDebtStatusMeta(movimiento.deudaEstado);
  const isDebt = movimiento.tipo === "deuda";
  const isPendingDebt = isDebt && movimiento.deudaEstado !== "pagada";
  const debtPaid = Number(movimiento.deudaPagado) || 0;
  const debtRemaining = Number(movimiento.monto) - debtPaid;
  const isPartialDebt = isPendingDebt && debtPaid > 0;
  const toneClass =
    movimiento.tipo === "ingreso"
      ? style.incomeRow
      : movimiento.tipo === "ahorro"
        ? style.savingsRow
        : isDebt
          ? style.debtRow
          : style.expenseRow;
  const amountLabel =
    typeMeta.signedAsPositive === null
      ? formatMoney(movimiento.monto, currentCurrency)
      : formatSignedMoney(
          movimiento.monto,
          currentCurrency,
          typeMeta.signedAsPositive
        );
  const amountTone = movimiento.desdeAhorro
    ? style.amountAhorro
    : movimiento.tipo === "ingreso"
      ? style.amountIngreso
      : movimiento.tipo === "ahorro"
        ? style.amountAhorro
        : movimiento.tipo === "deuda"
          ? style.amountDeuda
          : style.amountEgreso;

  const handleEdit = () => {
    onEditMovement?.(movimiento.sourceMovimiento || movimiento);
    navigate("/add");
  };

  const handleDelete = async () => {
    const movementId = movimiento.sourceId || movimiento._id;
    if (!movementId || !window.confirm("¿Eliminar movimiento?")) return;
    try {
      await movimientoService.delete(movementId);
      onMovementUpdate?.();
    } catch (error) {
      alert("No se pudo eliminar el movimiento");
    }
  };

  const handleEmitirFactura = async () => {
    const movementId = movimiento.sourceId || movimiento._id;
    if (!movementId) return;
    setFacturaBusy(true);
    setFacturaMsg(null);
    try {
      const res = await movimientoService.emitirFactura(movementId);
      const f = res.data?.factura;
      onMovementUpdate?.(res.data);
      setFacturaMsg({
        ok: true,
        text: f
          ? `Factura emitida: ${f.tipoNombre} N° ${f.numero} · CAE ${f.cae}`
          : "Factura emitida.",
      });
    } catch (err) {
      setFacturaMsg({
        ok: false,
        text: err.response?.data?.error || "No se pudo emitir la factura.",
      });
    } finally {
      setFacturaBusy(false);
    }
  };

  const handleStartSettle = () => {
    setSettleDate(getDayInputValue(new Date()));
    setSettleMethod("efectivo");
    setSettleDetail(
      movimiento.deudaAcreedor
        ? `Pago de deuda a ${movimiento.deudaAcreedor}`
        : "Pago de deuda"
    );
    setSettleMode("full");
    setSettleAmount("");
    setSettleOpen(true);
  };

  const handleConfirmSettle = async () => {
    const movementId = movimiento.sourceId || movimiento._id;
    if (!movementId) return;
    const alreadyPaid = Number(movimiento.deudaPagado) || 0;
    const remaining = Number(movimiento.monto) - alreadyPaid;
    const payload = {
      fecha: settleDate,
      medio: settleMethod,
      detalle: settleDetail.trim(),
    };
    if (settleMode === "partial") {
      const amt = Number(settleAmount);
      if (!settleAmount || Number.isNaN(amt) || amt <= 0) {
        alert("Ingresá un monto válido a pagar.");
        return;
      }
      if (amt > remaining + 0.001) {
        alert(`El monto no puede superar lo que resta (${formatMoney(remaining, currentCurrency)}).`);
        return;
      }
      payload.amount = amt;
    }
    try {
      setSettling(true);
      await movimientoService.settleDebt(movementId, payload);
      setSettleOpen(false);
      setSettleDetail("");
      setSettleAmount("");
      setSettleMode("full");
      onMovementUpdate?.();
    } catch (error) {
      alert(error.response?.data?.error || "No se pudo marcar la deuda como pagada");
    } finally {
      setSettling(false);
    }
  };

  return (
    <article className={`${style.row} ${style.tblRow} ${toneClass}`}>
      <span className={style.tblDate}>{formatDate(movimiento.fecha)}</span>

      <div className={style.tblDesc}>
        <span className={style.rowIcon}>{movementIcon(movimiento)}</span>
        <div className={style.rowText}>
          <p className={style.rowCategory}>{movimiento.categoria}</p>
          <p className={style.rowDetail}>{movimiento.detalle || "Sin detalle"}</p>
          {isDebt && movimiento.deudaAcreedor ? (
            <p className={style.rowExtra}>Acreedor: {movimiento.deudaAcreedor}</p>
          ) : null}
          {isDebt || movimiento.esRecurrente || movimiento.desdeAhorro || (ARCA_HABILITADO && movimiento.tipo === "ingreso") ? (
            <div className={style.tblBadges}>
              {isDebt ? (
                <span className={debtStatusMeta.tone === "paid" ? style.badgeNeutral : style.badgeWarning}>
                  {isPartialDebt ? "Parcial" : debtStatusMeta.label}
                </span>
              ) : null}
              {isDebt && movimiento.deudaEstado === "pagada" ? (
                <span className={style.badge}>Pagada {formatDate(movimiento.deudaPagadaAt)}</span>
              ) : null}
              {isPartialDebt ? (
                <span className={style.badge}>
                  Pagado {formatMoney(debtPaid, currentCurrency)} · resta {formatMoney(debtRemaining, currentCurrency)}
                </span>
              ) : null}
              {movimiento.esRecurrente ? (
                <span className={style.badgeAccent}>Fijo {movimiento.frecuencia}</span>
              ) : null}
              {movimiento.desdeAhorro ? <span className={style.badgeAccent}>Uso de ahorro</span> : null}
              {ARCA_HABILITADO && movimiento.tipo === "ingreso" ? (
                movimiento.factura && movimiento.factura.cae ? (
                  <span className={style.badgeAccent}>
                    {movimiento.factura.tipoNombre} N° {movimiento.factura.numero}
                  </span>
                ) : (
                  <button type="button" className={style.facturaBtn} onClick={handleEmitirFactura} disabled={facturaBusy}>
                    {facturaBusy ? "Emitiendo..." : "Emitir factura"}
                  </button>
                )
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className={style.tblCell}>
        <span className={style.tblPill} title={`Categoría: ${movimiento.categoria}`}>
          <em className={style.tblPillEmoji}>{categoryIcon}</em>
          <span className={style.tblPillText}>{movimiento.categoria}</span>
        </span>
      </div>

      <div className={style.tblCell}>
        {!isPendingDebt ? (
          <span className={style.tblPill} title={`Método: ${methodMeta.label}`}>
            {methodMeta.value === "transferencia" ? <FiSend /> : <FiDollarSign />}
            <span className={style.tblPillText}>{methodMeta.label}</span>
          </span>
        ) : (
          <span className={`${style.tblPill} ${style.tblPillMuted}`}>{typeMeta.label}</span>
        )}
      </div>

      <strong className={`${style.tblAmount} ${amountTone}`}>{amountLabel}</strong>

      <div className={`${style.rowActions} ${style.tblActions}`}>
        {isPendingDebt ? (
          <button type="button" className={style.payDebtButton} onClick={handleStartSettle}>
            Pagar
          </button>
        ) : null}
        <button type="button" className={style.actionButton} onClick={handleEdit} aria-label="Editar movimiento">
          <FiEdit2 />
        </button>
        <button
          type="button"
          className={`${style.actionButton} ${style.actionButtonDanger}`}
          onClick={handleDelete}
          aria-label="Eliminar movimiento"
        >
          <FiTrash2 />
        </button>
      </div>

      {facturaMsg ? (
        <p className={facturaMsg.ok ? style.facturaMsgOk : style.facturaMsgErr}>
          {facturaMsg.text}
        </p>
      ) : null}

      {settleOpen ? (
        <div className={style.settleOverlay} onClick={() => setSettleOpen(false)}>
          <div
            className={style.settleModal}
            onClick={(event) => event.stopPropagation()}
          >
            <h4 className={style.settleModalTitle}>Pagar deuda</h4>
            <p className={style.settleModalSub}>
              {movimiento.categoria} · resta {formatMoney(debtRemaining, currentCurrency)}
            </p>

            <div className={style.modeRow}>
              <button
                type="button"
                className={`${style.modeBtn} ${settleMode === "full" ? style.modeBtnActive : ""}`}
                onClick={() => setSettleMode("full")}
              >
                Todo
              </button>
              <button
                type="button"
                className={`${style.modeBtn} ${settleMode === "partial" ? style.modeBtnActive : ""}`}
                onClick={() => setSettleMode("partial")}
              >
                Una parte
              </button>
            </div>

            {settleMode === "partial" ? (
              <InputMonto
                value={settleAmount}
                onChange={setSettleAmount}
                className={style.input}
                placeholder={`Monto (máx ${formatMoney(debtRemaining, currentCurrency)})`}
              />
            ) : null}

            <input
              type="text"
              value={settleDetail}
              onChange={(event) => setSettleDetail(event.target.value)}
              className={style.input}
              placeholder="Detalle (opcional)"
            />

            <div className={style.settleActions}>
              <button
                type="button"
                className={style.cancelDebtButton}
                onClick={() => setSettleOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={style.confirmDebtButton}
                onClick={handleConfirmSettle}
                disabled={settling}
              >
                {settling ? "..." : "Aceptar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
