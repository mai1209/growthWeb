import { forwardRef, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiArrowLeft, FiAlertTriangle, FiX } from "react-icons/fi";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import style from "../style/Add.module.css";
import InputMonto from "./InputMonto";
import { movimientoService, categoriesService } from "../api";
import {
  CURRENCY_OPTIONS,
  MOVEMENT_METHOD_OPTIONS,
  RECURRENCE_OPTIONS,
  normalizeCurrency,
  normalizeMovementMethod,
} from "../utils/finance";

const MODE_CONFIG = {
  ingreso: {
    title: "Ingreso",
    description: "Registra cobros, ventas o entradas de efectivo.",
    tipo: "ingreso",
    recurrente: false,
    tone: "ingreso",
  },
  egreso: {
    title: "Egreso",
    description: "Guarda pagos, compras o gastos operativos.",
    tipo: "egreso",
    recurrente: false,
    tone: "egreso",
  },
  ahorro: {
    title: "Ahorro",
    description: "Separa dinero para objetivos, reserva o fondo de seguridad.",
    tipo: "ahorro",
    recurrente: false,
    tone: "ahorro",
  },
  "ahorro-uso": {
    title: "Usar ahorro",
    description: "Gasta plata del ahorro: descuenta del ahorro acumulado, no del saldo.",
    tipo: "egreso",
    recurrente: false,
    tone: "ahorro",
    desdeAhorro: true,
  },
  deuda: {
    title: "Deuda",
    description: "Registra lo que debes ahora y pagalo despues sin tocar la caja hasta ese momento.",
    tipo: "deuda",
    recurrente: false,
    tone: "deuda",
  },
  "ingreso-fijo": {
    title: "Ingreso fijo",
    description: "Se proyecta automaticamente segun la frecuencia elegida.",
    tipo: "ingreso",
    recurrente: true,
    tone: "ingreso",
  },
  "egreso-fijo": {
    title: "Gasto fijo",
    description: "Se repite segun la frecuencia que elijas y aparece en el panel.",
    tipo: "egreso",
    recurrente: true,
    tone: "egreso",
  },
};

// Íconos disponibles para las categorías (emoji: funcionan igual en web y app)
export const CATEGORY_EMOJIS = [
  // Comida y bebida
  "🍔", "🍕", "🍎", "🥑", "🍞", "🥩", "🥦", "☕", "🍺", "🍷", "🧉", "🍰",
  // Compras y hogar
  "🛒", "🛍️", "🎁", "🏠", "🛋️", "🧹", "🧼", "🧻", "💡", "🔌",
  // Transporte
  "🚗", "🚕", "🚌", "🚆", "✈️", "⛽", "🚲", "🛵",
  // Salud y bienestar
  "💊", "🩺", "🏥", "🦷", "🏋️", "🧘", "🧴",
  // Ropa y personal
  "👕", "👟", "👗", "🕶️", "💇", "💅",
  // Ocio y entretenimiento
  "🎬", "🎮", "🎧", "🎵", "📺", "🎟️", "📚", "🎨", "⚽", "🏀", "🎾",
  // Tecnología y trabajo
  "📱", "💻", "🖥️", "💼", "🧾", "🖊️", "📈", "📊",
  // Dinero y finanzas
  "💵", "💳", "🏦", "💰", "🪙",
  // Educación, familia y mascotas
  "🎓", "🐶", "🐱", "🧸", "👶",
  // Herramientas y varios
  "🔧", "🛠️", "🧰", "🌱", "🌍", "🏖️", "🏨", "🎉", "🏷️",
];

const getModeFromMovement = (movement) => {
  if (!movement) return "ingreso";
  if (movement.tipo === "deuda") return "deuda";
  if (movement.desdeAhorro) return "ahorro-uso";
  if (movement.esRecurrente) {
    return movement.tipo === "ingreso" ? "ingreso-fijo" : "egreso-fijo";
  }
  return movement.tipo === "ahorro" ? "ahorro" : movement.tipo;
};

function Add({ onMovementAdded, movementToEdit, only, defaultCurrency = "ARS", inModal = false, onNeedSavings }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEditing = !!movementToEdit;

  // ?tipo=ahorro|deuda|... preselecciona el modo (viene de las pestañas del Home)
  const tipoParam = searchParams.get("tipo");
  const [selectedMode, setSelectedMode] = useState(
    only ||
      (!movementToEdit && MODE_CONFIG[tipoParam] ? tipoParam : getModeFromMovement(movementToEdit))
  );
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [detalle, setDetalle] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [moneda, setMoneda] = useState(normalizeCurrency(defaultCurrency));
  const [medio, setMedio] = useState("efectivo");
  const [frecuencia, setFrecuencia] = useState("mensual");
  const [deudaAcreedor, setDeudaAcreedor] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingsPopup, setSavingsPopup] = useState(""); // aviso "ya gastaste tus ahorros"

  // Cerrar el popup NO deja el form de "usar ahorro": lleva a la vista de
  // ahorros (para cargar más). En el Dashboard cambia al modo "ahorro";
  // como página suelta, vuelve al home.
  const closeSavingsPopup = useCallback(() => {
    setSavingsPopup("");
    if (onNeedSavings) onNeedSavings();
    else navigate("/");
  }, [onNeedSavings, navigate]);

  // El popup de ahorro se cierra solo a los pocos segundos.
  useEffect(() => {
    if (!savingsPopup) return undefined;
    const t = setTimeout(() => closeSavingsPopup(), 4000);
    return () => clearTimeout(t);
  }, [savingsPopup, closeSavingsPopup]);

  // ===== Categorías del usuario (autocompletado + alta con ícono) =====
  const [categories, setCategories] = useState([]);
  const [catOpen, setCatOpen] = useState(false); // desplegable de sugerencias
  const [catModalOpen, setCatModalOpen] = useState(false); // alta de categoría
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🏷️");
  const [savingCat, setSavingCat] = useState(false);

  const loadCategories = async () => {
    try {
      const res = await categoriesService.getAll();
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch {
      // sin categorías, no bloquea el form
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const catSuggestions = useMemo(() => {
    const term = categoria.trim().toLowerCase();
    const list = term
      ? categories.filter((c) => c.nombre.toLowerCase().includes(term))
      : categories;
    return list.slice(0, 6);
  }, [categories, categoria]);

  const selectedCatIcon = useMemo(() => {
    const match = categories.find(
      (c) => c.nombre.toLowerCase() === categoria.trim().toLowerCase()
    );
    return match?.icono || null;
  }, [categories, categoria]);

  const handleCreateCategory = async () => {
    const nombre = newCatName.trim();
    if (!nombre) return;
    setSavingCat(true);
    try {
      const res = await categoriesService.create({ nombre, icono: newCatIcon });
      await loadCategories();
      setCategoria(res.data?.nombre || nombre);
      setCatModalOpen(false);
      setNewCatName("");
      setNewCatIcon("🏷️");
    } catch {
      // silencioso: el usuario puede reintentar
    } finally {
      setSavingCat(false);
    }
  };

  useEffect(() => {
    if (only) {
      setSelectedMode(only);
    }
  }, [only]);

  // Si llegan con ?tipo=... (desde las pestañas del Home), respetarlo siempre
  useEffect(() => {
    if (!only && !movementToEdit && MODE_CONFIG[tipoParam]) {
      setSelectedMode(tipoParam);
    }
  }, [tipoParam, only, movementToEdit]);

  useEffect(() => {
    if (!movementToEdit) {
      setMonto("");
      setCategoria("");
      setDetalle("");
      setSelectedDate(new Date());
      setMoneda(normalizeCurrency(defaultCurrency));
      setMedio("efectivo");
      setFrecuencia("mensual");
      setDeudaAcreedor("");
      return;
    }

    const fechaUTC = new Date(movementToEdit.fecha);
    fechaUTC.setMinutes(fechaUTC.getMinutes() + fechaUTC.getTimezoneOffset());

    setSelectedMode(getModeFromMovement(movementToEdit));
    setMonto(String(movementToEdit.monto ?? ""));
    setCategoria(movementToEdit.categoria || "");
    setDetalle(movementToEdit.detalle || "");
    setSelectedDate(fechaUTC);
    setMoneda(normalizeCurrency(movementToEdit.moneda));
    setMedio(normalizeMovementMethod(movementToEdit.medio));
    setFrecuencia(movementToEdit.frecuencia || "mensual");
    setDeudaAcreedor(movementToEdit.deudaAcreedor || "");
  }, [movementToEdit, defaultCurrency]);

  const mode = useMemo(
    () => MODE_CONFIG[selectedMode] || MODE_CONFIG.ingreso,
    [selectedMode]
  );
  const isDebtMode = mode.tipo === "deuda";

  const CustomDateInput = forwardRef(({ value, onClick, id }, ref) => (
    <input
      id={id}
      className={style.datePicker}
      onClick={onClick}
      ref={ref}
      value={value}
      readOnly
    />
  ));

  CustomDateInput.displayName = "CustomDateInput";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    if (!monto || Number.isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) {
      setError("Ingresa un monto valido.");
      setLoading(false);
      return;
    }

    if (!categoria.trim()) {
      setError("La categoria es obligatoria.");
      setLoading(false);
      return;
    }

    if (isDebtMode && !deudaAcreedor.trim()) {
      setError("Indica a quien le debes ese monto.");
      setLoading(false);
      return;
    }

    const fechaLocal = new Date(selectedDate);
    fechaLocal.setMinutes(fechaLocal.getMinutes() - fechaLocal.getTimezoneOffset());
    const fechaFormateada = fechaLocal.toISOString().slice(0, 10);

    const dataToSend = {
      tipo: mode.tipo,
      monto: parseFloat(monto),
      categoria: categoria.trim(),
      fecha: fechaFormateada,
      detalle: detalle.trim(),
      moneda: normalizeCurrency(moneda),
      medio: isDebtMode ? undefined : normalizeMovementMethod(medio),
      esRecurrente: mode.recurrente,
      frecuencia: mode.recurrente ? frecuencia : null,
      deudaAcreedor: isDebtMode ? deudaAcreedor.trim() : "",
      desdeAhorro: Boolean(mode.desdeAhorro),
    };

    try {
      let savedMovement;

      if (isEditing) {
        const response = await movimientoService.update(movementToEdit._id, dataToSend);
        savedMovement = response.data;
      } else {
        const response = await movimientoService.create(dataToSend);
        savedMovement = response.data;
      }

      onMovementAdded?.(savedMovement);

      if (!isEditing) {
        setMonto("");
        setCategoria("");
        setDetalle("");
        setSelectedDate(new Date());
        setMedio("efectivo");
        setDeudaAcreedor("");
      }

      if (!only) {
        navigate("/");
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === "AHORRO_INSUFICIENTE") {
        setSavingsPopup(data.error || "Ya gastaste tus ahorros. Cargá más para seguir gastando desde ahí.");
      } else {
        setError(data?.error || "Error al guardar el movimiento");
      }
    } finally {
      setLoading(false);
    }
  };

  const toneClass =
    mode.tone === "ingreso"
      ? style.formIngreso
      : mode.tone === "egreso"
        ? style.formEgreso
        : mode.tone === "deuda"
          ? style.formDeuda
          : style.formAhorro;

  return (
    <div className={`${style.container} ${!only && !inModal ? style.containerPage : ""}`}>
      {loading && <div className={style.spinner}></div>}

      {isEditing && (
        <div className={style.editTopBar}>
          <button
            type="button"
            className={style.editBackButton}
            onClick={() => {
              onMovementAdded?.();
              navigate(-1);
            }}
          >
            <FiArrowLeft />
            Volver
          </button>
        </div>
      )}

      {!only && !isEditing && (
        <div className={style.modeSelector}>
          {Object.entries(MODE_CONFIG).map(([key, config]) => (
            <button
              key={key}
              type="button"
              className={`${style.modeButton} ${
                selectedMode === key ? style.modeButtonActive : ""
              }`}
              onClick={() => setSelectedMode(key)}
            >
              {config.title}
            </button>
          ))}
        </div>
      )}

      {!isEditing && !inModal && (
        <div className={style.closePanelRow}>
          <button
            type="button"
            className={style.closePanelButton}
            onClick={() => navigate("/")}
            aria-label="Cerrar"
            title="Cerrar sin guardar"
          >
            <FiX />
          </button>
        </div>
      )}

      <form className={`${style.formCard} ${toneClass}`} onSubmit={handleSubmit}>
        <div className={style.formHeader}>
          <div>
            <p className={style.formEyebrow}>{mode.title}</p>
          </div>

          <div
            className={`${style.currencySwitch} ${
              moneda === "USD" ? style.currencySwitchUsd : style.currencySwitchArs
            }`}
          >
            {CURRENCY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${style.currencyOption} ${
                  moneda === option.value ? style.currencyOptionActive : ""
                }`}
                onClick={() => setMoneda(option.value)}
              >
                {option.codeLabel}
              </button>
            ))}
          </div>
        </div>

        <div className={`${style.field} ${style.fieldFull} ${style.amountField}`}>
          <div className={style.fieldLabelRow}>
            <label className={style.fieldLabel} htmlFor="monto">
              Monto
            </label>
            <span className={style.fieldTag}>
              {moneda === "USD" ? "Dolares" : "Pesos"}
            </span>
          </div>

          <InputMonto
            className={style.inputMonto}
            value={monto}
            onChange={setMonto}
            placeholder={`Monto en ${moneda === "USD" ? "USD" : "ARS"}`}
            id="monto"
          />
        </div>

        <div className={isDebtMode ? style.fieldGridDual : style.fieldGridTriple}>
          <div className={`${style.field} ${style.catField}`}>
            <label className={style.fieldLabel} htmlFor="categoria">
              Categoria
            </label>
            <div className={style.catInputWrap}>
              {selectedCatIcon ? (
                <span className={style.catInputIcon}>{selectedCatIcon}</span>
              ) : null}
              <input
                id="categoria"
                name="categoria"
                className={`${style.btn} ${selectedCatIcon ? style.catInputWithIcon : ""}`}
                placeholder={
                  isDebtMode
                    ? "Ej: prestamo, tarjeta, adelanto"
                    : "Ej: ventas, alquiler, supermercado"
                }
                value={categoria}
                onChange={(event) => {
                  setCategoria(event.target.value);
                  setCatOpen(true);
                }}
                onFocus={() => setCatOpen(true)}
                onBlur={() => setTimeout(() => setCatOpen(false), 150)}
                autoComplete="off"
                required
              />
            </div>

            {catOpen ? (
              <div className={style.catDropdown}>
                {/* Crear siempre como primera opción */}
                <button
                  type="button"
                  className={`${style.catOption} ${style.catOptionNew}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setNewCatName(categoria.trim());
                    setCatModalOpen(true);
                    setCatOpen(false);
                  }}
                >
                  <span className={style.catNewPlus}>+</span> Nueva categoría
                  {categoria.trim() ? ` “${categoria.trim()}”` : ""}
                </button>

                {catSuggestions.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    className={style.catOption}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setCategoria(c.nombre);
                      setCatOpen(false);
                    }}
                  >
                    <span>{c.icono}</span> {c.nombre}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className={style.field}>
            <label className={style.fieldLabel} htmlFor="fecha-movimiento">
              Fecha
            </label>
            <DatePicker
              id="fecha-movimiento"
              selected={selectedDate}
              onChange={setSelectedDate}
              dateFormat="dd/MM/yyyy"
              customInput={<CustomDateInput />}
              wrapperClassName={style.datePickerWrapper}
            />
          </div>

          {!isDebtMode && (
            <div className={style.field}>
              <div className={style.fieldLabelRow}>
                <label className={style.fieldLabel}>Medio</label>
                <span className={style.fieldTag}>
                  {medio === "transferencia" ? "Digital" : "Fisico"}
                </span>
              </div>

              <div
                className={`${style.methodSwitch} ${
                  medio === "transferencia"
                    ? style.methodSwitchTransferencia
                    : style.methodSwitchEfectivo
                }`}
              >
                {MOVEMENT_METHOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${style.methodOption} ${
                      medio === option.value ? style.methodOptionActive : ""
                    }`}
                    onClick={() => setMedio(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {isDebtMode && (
          <div className={style.fieldGrid}>
            <div className={style.field}>
              <label className={style.fieldLabel} htmlFor="deuda-acreedor">
                A quien le debes
              </label>
              <input
                id="deuda-acreedor"
                name="deudaAcreedor"
                className={style.btn}
                placeholder="Ej: banco, amigo, proveedor"
                value={deudaAcreedor}
                onChange={(event) => setDeudaAcreedor(event.target.value)}
                required
              />
            </div>

            <div className={`${style.helperBox} ${style.field}`}>
              La deuda queda visible en el panel principal y despues la podes
              marcar como pagada desde el detalle mensual.
            </div>
          </div>
        )}

        {mode.recurrente && (
          <div className={style.fieldGrid}>
            <div className={style.field}>
              <label className={style.fieldLabel} htmlFor="frecuencia">
                Frecuencia
              </label>
              <select
                id="frecuencia"
                className={style.select}
                value={frecuencia}
                onChange={(event) => setFrecuencia(event.target.value)}
              >
                {RECURRENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={`${style.helperBox} ${style.field}`}>
              Se tomara la fecha elegida como inicio y se repetira segun la
              frecuencia seleccionada.
            </div>
          </div>
        )}

        <div className={`${style.fieldGrid} ${style.detailGrid}`}>
          <div className={`${style.field} ${style.fieldWide}`}>
            <label className={style.fieldLabel} htmlFor="detalle">
              Detalle
            </label>
            <input
              id="detalle"
              name="detalle"
              className={style.detalle}
              placeholder="Agrega una referencia, nota breve o descripcion"
              value={detalle}
              onChange={(event) => setDetalle(event.target.value)}
            />
          </div>

          <div className={style.submitWrap}>
            <button className={style.buttonSend} type="submit" disabled={loading}>
              {isEditing ? "Guardar cambios" : `Guardar ${mode.title.toLowerCase()}`}
            </button>
          </div>
        </div>
      </form>

      {/* Alta de categoría con ícono */}
      {catModalOpen ? (
        <div className={style.catOverlay} onClick={() => setCatModalOpen(false)}>
          <div className={style.catModal} onClick={(event) => event.stopPropagation()}>
            <h4 className={style.catModalTitle}>Nueva categoría</h4>

            <input
              className={style.btn}
              placeholder="Nombre (ej: Comida)"
              value={newCatName}
              onChange={(event) => setNewCatName(event.target.value)}
              maxLength={40}
              autoFocus
            />

            <p className={style.catModalLabel}>Ícono</p>
            <div className={style.catEmojiGrid}>
              {CATEGORY_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`${style.catEmoji} ${
                    newCatIcon === emoji ? style.catEmojiActive : ""
                  }`}
                  onClick={() => setNewCatIcon(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className={style.catModalActions}>
              <button
                type="button"
                className={style.catCancelBtn}
                onClick={() => setCatModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={style.catSaveBtn}
                onClick={handleCreateCategory}
                disabled={savingCat || !newCatName.trim()}
              >
                {savingCat ? "..." : `Crear ${newCatIcon}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditing && (
        <div className={style.cancelContainer}>
          <button
            className={style.cancelButton}
            type="button"
            onClick={() => {
              onMovementAdded?.();
              navigate("/");
            }}
          >
            Cancelar edicion
          </button>
        </div>
      )}

      {error && <p className={style.errorText}>{error}</p>}

      {/* Popup centrado: "ya gastaste tus ahorros". Cierra al tocar afuera o solo. */}
      {savingsPopup ? (
        <div
          className={style.savingsOverlay}
          onClick={closeSavingsPopup}
          role="presentation"
        >
          <div
            className={style.savingsCard}
            onClick={(event) => event.stopPropagation()}
            role="alertdialog"
            aria-label="Aviso de ahorro"
          >
            <div className={style.savingsIcon}>
              <FiAlertTriangle />
            </div>
            <p className={style.savingsText}>{savingsPopup}</p>
            <button
              type="button"
              className={style.savingsBtn}
              onClick={closeSavingsPopup}
            >
              Cargar ahorro
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Add;
