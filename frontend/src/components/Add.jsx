import { forwardRef, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import style from "../style/Add.module.css";
import InputMonto from "./InputMonto";
import { movimientoService } from "../api";
import {
  CURRENCY_OPTIONS,
  RECURRENCE_OPTIONS,
  normalizeCurrency,
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

const getModeFromMovement = (movement) => {
  if (!movement) return "ingreso";
  if (movement.esRecurrente) {
    return movement.tipo === "ingreso" ? "ingreso-fijo" : "egreso-fijo";
  }
  return movement.tipo === "ahorro" ? "ahorro" : movement.tipo;
};

function Add({ onMovementAdded, movementToEdit, only, defaultCurrency = "ARS" }) {
  const navigate = useNavigate();
  const isEditing = !!movementToEdit;

  const [selectedMode, setSelectedMode] = useState(
    only || getModeFromMovement(movementToEdit)
  );
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [detalle, setDetalle] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [moneda, setMoneda] = useState(normalizeCurrency(defaultCurrency));
  const [frecuencia, setFrecuencia] = useState("mensual");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (only) {
      setSelectedMode(only);
    }
  }, [only]);

  useEffect(() => {
    if (!movementToEdit) {
      setMonto("");
      setCategoria("");
      setDetalle("");
      setSelectedDate(new Date());
      setMoneda(normalizeCurrency(defaultCurrency));
      setFrecuencia("mensual");
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
    setFrecuencia(movementToEdit.frecuencia || "mensual");
  }, [movementToEdit, defaultCurrency]);

  const mode = useMemo(
    () => MODE_CONFIG[selectedMode] || MODE_CONFIG.ingreso,
    [selectedMode]
  );

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
      esRecurrente: mode.recurrente,
      frecuencia: mode.recurrente ? frecuencia : null,
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
      }

      if (!only) {
        navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Error al guardar el movimiento");
    } finally {
      setLoading(false);
    }
  };

  const toneClass =
    mode.tone === "ingreso"
      ? style.formIngreso
      : mode.tone === "egreso"
        ? style.formEgreso
        : style.formAhorro;

  return (
    <div className={style.container}>
      {loading && <div className={style.spinner}></div>}

      <div className={style.titleRow}>
        <div>
          <p className={style.kicker}>Movimientos</p>
          <h2 className={style.title}>
            {isEditing ? "Editar movimiento" : `Cargar ${mode.title.toLowerCase()}`}
          </h2>
        </div>
        <p className={style.subtitle}>
          {mode.recurrente
            ? "Los movimientos fijos se renderizan automaticamente segun la frecuencia elegida."
            : "Cada movimiento puede guardarse en pesos o dolares sin mezclar cajas."}
        </p>
      </div>

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

      <form className={`${style.formCard} ${toneClass}`} onSubmit={handleSubmit}>
        <div className={style.formHeader}>
          <div>
            <p className={style.formEyebrow}>{mode.title}</p>
            <h3>{mode.description}</h3>
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

        <div className={style.fieldGrid}>
          <div className={style.field}>
            <label className={style.fieldLabel} htmlFor="categoria">
              Categoria
            </label>
            <input
              id="categoria"
              name="categoria"
              className={style.btn}
              placeholder="Ej: ventas, alquiler, supermercado"
              value={categoria}
              onChange={(event) => setCategoria(event.target.value)}
              required
            />
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
        </div>

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
    </div>
  );
}

export default Add;
