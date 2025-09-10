import { useState, useEffect, forwardRef } from "react";
import axios from "axios";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import style from '../style/Add.module.css';
import InputMonto from "./InputMonto"; 

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function Add({ onMovementAdded, movementToEdit }) {
  const [ingresoMonto, setIngresoMonto] = useState('');
  const [egresoMonto, setEgresoMonto] = useState('');
  const [categoria, setCategoria] = useState('');
  const [detalle, setDetalle] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isEditing = !!movementToEdit;

  useEffect(() => {
    if (isEditing) {
      // --- CORRECCIÓN DE ZONA HORARIA AL EDITAR ---
      const fechaUTC = new Date(movementToEdit.fecha);
      // Le sumamos el desfase horario para que la fecha local sea la correcta
      fechaUTC.setMinutes(fechaUTC.getMinutes() + fechaUTC.getTimezoneOffset());
      // ---------------------------------------------
      
      setCategoria(movementToEdit.categoria);
      setDetalle(movementToEdit.detalle || '');
      setSelectedDate(fechaUTC); // Usamos la fecha corregida

      if (movementToEdit.tipo === 'ingreso') {
        setIngresoMonto(movementToEdit.monto.toString());
        setEgresoMonto('');
      } else {
        setEgresoMonto(movementToEdit.monto.toString());
        setIngresoMonto('');
      }
    } else {
      setCategoria('');
      setDetalle('');
      setIngresoMonto('');
      setEgresoMonto('');
      setSelectedDate(new Date());
    }
  }, [movementToEdit, isEditing]);

  const handleDateChange = (date) => setSelectedDate(date);

  const handleSubmit = async (e, tipo) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const monto = tipo === 'ingreso' ? ingresoMonto : egresoMonto;
    if (!monto || isNaN(parseFloat(monto)) || parseFloat(monto) <= 0) {
      setError("Por favor, ingresa un monto válido.");
      setLoading(false);
      return;
    }

    const fechaLocal = new Date(selectedDate);
    fechaLocal.setMinutes(fechaLocal.getMinutes() - fechaLocal.getTimezoneOffset());
    const fechaFormateada = fechaLocal.toISOString().slice(0, 10);

    const dataToSend = {
      tipo: isEditing ? movementToEdit.tipo : tipo, // Usamos el tipo original al editar
      monto: parseFloat(monto),
      categoria: categoria,
      fecha: fechaFormateada,
      detalle: detalle
    };

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No se encontró autorización.");

      if (isEditing) {
        await axios.put(`${API_URL}/api/add/${movementToEdit._id}`, dataToSend, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_URL}/api/add`, dataToSend, {
          headers: { Authorization: `Bearer ${token}` }
        });
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
  CustomDateInput.displayName = 'CustomDateInput';

  return (
    <div className={style.container}>
      {loading && <div className={style.spinner}></div>}

      <p className={style.title}>{isEditing ? `Editando Movimiento` : 'Añadir ingreso / Añadir egreso'}</p>
      
      <div className={style.containerAllForm}>
        {/* --- Formulario de Ingreso --- */}
        <form className={style.formone} onSubmit={(e) => handleSubmit(e, "ingreso")}>
            <InputMonto  className={style.inputMonto}  value={ingresoMonto} onChange={setIngresoMonto} disabled={isEditing && movementToEdit.tipo === 'egreso'} />
            <div className={style.containerBtn}>
                <input name="categoria" className={style.btn} placeholder="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)} required disabled={isEditing && movementToEdit.tipo === 'egreso'} />
                <DatePicker selected={selectedDate} onChange={handleDateChange} dateFormat="dd/MM/yyyy" customInput={<CustomDateInput />} wrapperClassName={style.datePickerWrapper} disabled={isEditing && movementToEdit.tipo === 'egreso'} />
            </div>
            <div className={style.containerDetalle}>
                <input name="detalle" className={style.detalle} placeholder="Detalle" value={detalle} onChange={(e) => setDetalle(e.target.value)} disabled={isEditing && movementToEdit.tipo === 'egreso'} />
                <button className={style.buttonSend} type="submit" disabled={loading || (isEditing && movementToEdit.tipo === 'egreso')}>
                  {isEditing ? 'Guardar Cambios' : 'Añadir ingreso'}
                </button>
            </div>
        </form>

        {/* --- Formulario de Egreso --- */}
        <form className={style.formtwo} onSubmit={(e) => handleSubmit(e, "egreso")}>
            <InputMonto     className={style.inputMonto} value={egresoMonto} onChange={setEgresoMonto} disabled={isEditing && movementToEdit.tipo === 'ingreso'} />
            <div className={style.containerBtn}>
                <input name="categoria" className={style.btn} placeholder="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)} required disabled={isEditing && movementToEdit.tipo === 'ingreso'} />
                <DatePicker selected={selectedDate} onChange={handleDateChange} dateFormat="dd/MM/yyyy" customInput={<CustomDateInput />} wrapperClassName={style.datePickerWrapper} disabled={isEditing && movementToEdit.tipo === 'ingreso'} />
            </div>
            <div className={style.containerDetalle}>
                <input name="detalle" className={style.detalle} placeholder="Detalle" value={detalle} onChange={(e) => setDetalle(e.target.value)} disabled={isEditing && movementToEdit.tipo === 'ingreso'} />
                <button className={style.buttonSend} type="submit" disabled={loading || (isEditing && movementToEdit.tipo === 'ingreso')}>
                  {isEditing ? 'Guardar Cambios' : 'Añadir egreso'}
                </button>
            </div>
        </form>
      </div>
      {isEditing && (
        <div className={style.cancelContainer}>
          <button className={style.cancelButton} type="button" onClick={onMovementAdded}>
            Cancelar Edición
          </button>
        </div>
      )}
      {error && <p className={style.errorText}>{error}</p>}
    </div>
  );
}

export default Add;