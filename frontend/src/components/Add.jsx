import { useState, useEffect, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import style from "../style/Add.module.css";
import InputMonto from "./InputMonto";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

function Add({ onMovementAdded, movementToEdit, only }) {
  const navigate = useNavigate();
  const [ingresoMonto, setIngresoMonto] = useState("");
  const [egresoMonto, setEgresoMonto] = useState("");
  const [categoriaIngreso, setCategoriaIngreso] = useState("");
  const [categoriaEgreso, setCategoriaEgreso] = useState("");
  const [detalleIngreso, setDetalleIngreso] = useState("");
  const [detalleEgreso, setDetalleEgreso] = useState("");
  const [selectedDateIngreso, setSelectedDateIngreso] = useState(new Date());
  const [selectedDateEgreso, setSelectedDateEgreso] = useState(new Date());

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isEditing = !!movementToEdit;

  useEffect(() => {
    if (isEditing) {
      const fechaUTC = new Date(movementToEdit.fecha);
      fechaUTC.setMinutes(fechaUTC.getMinutes() + fechaUTC.getTimezoneOffset());
      if (movementToEdit.tipo === "ingreso") {
        setIngresoMonto(movementToEdit.monto.toString());
        setCategoriaIngreso(movementToEdit.categoria);
        setDetalleIngreso(movementToEdit.detalle || "");
        setSelectedDateIngreso(fechaUTC);
        setEgresoMonto("");
        setCategoriaEgreso("");
        setDetalleEgreso("");
        setSelectedDateEgreso(new Date());
      } else {
        setEgresoMonto(movementToEdit.monto.toString());
        setCategoriaEgreso(movementToEdit.categoria);
        setDetalleEgreso(movementToEdit.detalle || "");
        setSelectedDateEgreso(fechaUTC);
        setIngresoMonto("");
        setCategoriaIngreso("");
        setDetalleIngreso("");
        setSelectedDateIngreso(new Date());
      }
    } else {
      setIngresoMonto("");
      setCategoriaIngreso("");
      setDetalleIngreso("");
      setSelectedDateIngreso(new Date());
      setEgresoMonto("");
      setCategoriaEgreso("");
      setDetalleEgreso("");
      setSelectedDateEgreso(new Date());
    }
  }, [movementToEdit, isEditing]);

  const handleDateChangeIngreso = (date) => setSelectedDateIngreso(date);
  const handleDateChangeEgreso = (date) => setSelectedDateEgreso(date);

  const handleSubmit = async (e, tipo) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    let monto, categoria, detalle, selectedDate;
    if (tipo === "ingreso") {
      monto = ingresoMonto;
      categoria = categoriaIngreso;
      detalle = detalleIngreso;
      selectedDate = selectedDateIngreso;
    } else {
      monto = egresoMonto;
      categoria = categoriaEgreso;
      detalle = detalleEgreso;
      selectedDate = selectedDateEgreso;
    }
    if (!monto || isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) {
      setError("Por favor, ingresa un monto válido.");
      setLoading(false);
      return;
    }
    const fechaLocal = new Date(selectedDate);
    fechaLocal.setMinutes(
      fechaLocal.getMinutes() - fechaLocal.getTimezoneOffset(),
    );
    const fechaFormateada = fechaLocal.toISOString().slice(0, 10);
    const dataToSend = {
      tipo: isEditing ? movementToEdit.tipo : tipo,
      monto: parseFloat(monto),
      categoria: categoria,
      fecha: fechaFormateada,
      detalle: detalle,
    };

    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) throw new Error("No se encontró autorización.");

      if (isEditing) {
        await axios.put(
          `${API_URL}/api/add/${movementToEdit._id}`,
          dataToSend,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } else {
        await axios.post(`${API_URL}/api/add`, dataToSend, {
          headers: { Authorization: `Bearer ${token}` },
        });
        // Limpiar solo los inputs del formulario usado
        if (tipo === "ingreso") {
          setIngresoMonto("");
          setCategoriaIngreso("");
          setDetalleIngreso("");
          setSelectedDateIngreso(new Date());
        } else {
          setEgresoMonto("");
          setCategoriaEgreso("");
          setDetalleEgreso("");
          setSelectedDateEgreso(new Date());
        }
      }
      if (onMovementAdded) onMovementAdded();
    } catch (err) {
      setError(err.response?.data?.error || "Error al guardar el movimiento");
    } finally {
      setLoading(false);
    }
  };

  const CustomDateInput = forwardRef(({ value, onClick }, ref) => (
    <input
      className={style.datePicker}
      onClick={onClick}
      ref={ref}
      value={value}
      readOnly
    />
  ));
  CustomDateInput.displayName = "CustomDateInput";

  return (
    <div className={style.container}>
      {loading && <div className={style.spinner}></div>}

      <p className={style.title}>
        {isEditing ? `Editando Movimiento` : "Añadir Movimiento "}
      </p>

      <div className={style.containerAllForm}>
        {/* --- Formulario de Ingreso --- */}
        {(!only || only === "ingreso") &&
          (!isEditing || movementToEdit.tipo === "ingreso") && (
            <form
              className={style.formone}
              onSubmit={(e) => handleSubmit(e, "ingreso")}
            >
              <InputMonto
                className={style.inputMonto}
                value={ingresoMonto}
                onChange={setIngresoMonto}
                disabled={isEditing && movementToEdit.tipo === "egreso"}
              />
              <div className={style.containerBtn}>
                <input
                  name="categoriaIngreso"
                  className={style.btn}
                  placeholder="Categoría"
                  value={categoriaIngreso}
                  onChange={(e) => setCategoriaIngreso(e.target.value)}
                  required
                  disabled={isEditing && movementToEdit.tipo === "egreso"}
                />
                <DatePicker
                  selected={selectedDateIngreso}
                  onChange={handleDateChangeIngreso}
                  dateFormat="dd/MM/yyyy"
                  customInput={<CustomDateInput />}
                  wrapperClassName={style.datePickerWrapper}
                  disabled={isEditing && movementToEdit.tipo === "egreso"}
                />
              </div>
              <div className={style.containerDetalle}>
                <input
                  name="detalleIngreso"
                  className={style.detalle}
                  placeholder="Detalle"
                  value={detalleIngreso}
                  onChange={(e) => setDetalleIngreso(e.target.value)}
                  disabled={isEditing && movementToEdit.tipo === "egreso"}
                />
                <button
                  className={style.buttonSend}
                  type="submit"
                  disabled={
                    loading || (isEditing && movementToEdit.tipo === "egreso")
                  }
                >
                  {isEditing ? "Guardar Cambios" : "Añadir ingreso"}
                </button>
              </div>
            </form>
          )}

        {/* --- Formulario de Egreso --- */}
        {(!only || only === "egreso") &&
          (!isEditing || movementToEdit.tipo === "egreso") && (
            <form
              className={style.formtwo}
              onSubmit={(e) => handleSubmit(e, "egreso")}
            >
              <InputMonto
                className={style.inputMonto}
                value={egresoMonto}
                onChange={setEgresoMonto}
                disabled={isEditing && movementToEdit.tipo === "ingreso"}
              />
              <div className={style.containerBtn}>
                <input
                  name="categoriaEgreso"
                  className={style.btn}
                  placeholder="Categoría"
                  value={categoriaEgreso}
                  onChange={(e) => setCategoriaEgreso(e.target.value)}
                  required
                  disabled={isEditing && movementToEdit.tipo === "ingreso"}
                />
                <DatePicker
                  selected={selectedDateEgreso}
                  onChange={handleDateChangeEgreso}
                  dateFormat="dd/MM/yyyy"
                  customInput={<CustomDateInput />}
                  wrapperClassName={style.datePickerWrapper}
                  disabled={isEditing && movementToEdit.tipo === "ingreso"}
                />
              </div>
              <div className={style.containerDetalle}>
                <input
                  name="detalleEgreso"
                  className={style.detalle}
                  placeholder="Detalle"
                  value={detalleEgreso}
                  onChange={(e) => setDetalleEgreso(e.target.value)}
                  disabled={isEditing && movementToEdit.tipo === "ingreso"}
                />
                <button
                  className={style.buttonSend}
                  type="submit"
                  disabled={
                    loading || (isEditing && movementToEdit.tipo === "ingreso")
                  }
                >
                  {isEditing ? "Guardar Cambios" : "Añadir egreso"}
                </button>
              </div>
            </form>
          )}
      </div>
      {isEditing && (
        <div className={style.cancelContainer}>
          <button
            className={style.cancelButton}
            type="button"
            onClick={() => {
              if (onMovementAdded) onMovementAdded();
              navigate("/");
            }}
          >
            Cancelar Edición
          </button>
        </div>
      )}
      {error && <p className={style.errorText}>{error}</p>}
    </div>
  );
}

export default Add;
