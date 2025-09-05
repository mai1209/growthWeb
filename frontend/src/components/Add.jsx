import { useState, forwardRef } from "react";
import axios from "axios";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import style from '../style/Add.module.css';
import InputMonto from "./InputMonto"; 

function Add({ onMovementAdded }) {
  const [ingresoMonto, setIngresoMonto] = useState('');
  const [egresoMonto, setEgresoMonto] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState(new Date());

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  const handleSubmit = async (e, tipo, monto) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return setError("No se encontró autorización. Inicia sesión de nuevo.");
    }

    const form = e.target;
    const montoNumerico = parseFloat(monto);
    if (isNaN(montoNumerico) || montoNumerico <= 0) {
      setLoading(false);
      return setError("Por favor, ingresa un monto válido.");
    }

    const fechaLocal = new Date(selectedDate);
    fechaLocal.setMinutes(fechaLocal.getMinutes() - fechaLocal.getTimezoneOffset());
    const fechaFormateada = fechaLocal.toISOString().slice(0, 10);

    const data = {
      tipo,
      monto: montoNumerico,
      categoria: form.categoria.value,
      fecha: fechaFormateada,
      detalle: form.detalle.value
    };

    try {
      await axios.post(`${API_URL}/api/add`,  data, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
   
      form.reset();
      if (tipo === "ingreso") setIngresoMonto('');
      else setEgresoMonto('');

      if (onMovementAdded) {
        onMovementAdded();
      }

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

      <p className={style.title}>Añadir ingreso / Añadir egreso</p>
      
      <div className={style.containerAllForm}>
        {/* --- Formulario de Ingreso --- */}
        <form className={style.formone} onSubmit={(e) => handleSubmit(e, "ingreso", ingresoMonto)}>
            <InputMonto className={style.input} value={ingresoMonto} onChange={setIngresoMonto} />
            <div className={style.containerBtn}>
                <input name="categoria" className={style.btn} placeholder="Categoría" required />
                <DatePicker
                  selected={selectedDate}
                  onChange={handleDateChange}
                  dateFormat="dd/MM/yyyy"
                  customInput={<CustomDateInput />}
                  wrapperClassName={style.datePickerWrapper}
                />
            </div>
            <div className={style.containerDetalle}>
                <input name="detalle" className={style.detalle} placeholder="Detalle" />
                <button className={style.buttonSend} type="submit" disabled={loading}>Añadir ingreso</button>
            </div>
        </form>

        {/* --- Formulario de Egreso --- */}
        <form className={style.formtwo} onSubmit={(e) => handleSubmit(e, "egreso", egresoMonto)}>
            <InputMonto className={style.input} value={egresoMonto} onChange={setEgresoMonto} />
            <div className={style.containerBtn}>
                <input name="categoria" className={style.btn} placeholder="Categoría" required />
                <DatePicker
                  selected={selectedDate}
                  onChange={handleDateChange}
                  dateFormat="dd/MM/yyyy"
                  customInput={<CustomDateInput />}
                  wrapperClassName={style.datePickerWrapper}
                />
            </div>
            <div className={style.containerDetalle}>
                <input name="detalle" className={style.detalle} placeholder="Detalle" />
                <button className={style.buttonSend} type="submit" disabled={loading}>Añadir egreso</button>
            </div>
        </form>
      </div>
      {error && <p style={{ color: 'red', textAlign: 'center', marginTop: '1rem' }}>{error}</p>}
    </div>
  );
}

export default Add;