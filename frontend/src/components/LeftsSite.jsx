// LeftSite.jsx (CORREGIDO Y FINAL)

import { useState, useEffect } from 'react';
import axios from 'axios';
import style from '../style/LeftSite.module.css';

function LeftSite({ token, refreshKey }) {
  // --- NUEVO: Estado para controlar la visibilidad de los montos ---
  const [areTotalsVisible, setAreTotalsVisible] = useState(true);
  
  const [isOpen, setIsOpen] = useState(true);
  const [movimientos, setMovimientos] = useState([]);
  const [totales, setTotales] = useState({ ingreso: 0, egreso: 0, total: 0 });

  const toggleContainer = () => setIsOpen(!isOpen);
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

  // --- NUEVO: Función para alternar la visibilidad ---
  const toggleTotalsVisibility = () => {
    setAreTotalsVisible(!areTotalsVisible);
  };

  useEffect(() => {
    const fetchMovimientos = async () => {
      if (!token) {
        setMovimientos([]);
        return;
      }
      try {
        const res = await axios.get(`${API_URL}/api/add`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMovimientos(res.data);
      } catch (err) {
        console.error("Error al obtener movimientos en LeftSite:", err);
        setMovimientos([]);
      }
    };
    fetchMovimientos();
  }, [token, refreshKey , API_URL]);

  useEffect(() => {
    if (movimientos && movimientos.length > 0) {
      const ingreso = movimientos.filter(m => m.tipo === "ingreso").reduce((acc, cur) => acc + Number(cur.monto), 0);
      const egreso = movimientos.filter(m => m.tipo === "egreso").reduce((acc, cur) => acc + Number(cur.monto), 0);
      setTotales({ ingreso, egreso, total: ingreso - egreso });
    } else {
      setTotales({ ingreso: 0, egreso: 0, total: 0 });
    }
  }, [movimientos]);

  const formatNumber = (num) => 
    num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className={`${style.container} ${!isOpen ? style.closed : ''}`}>
      <div className={style.containerOpenClose}>
        <img 
          className={style.close} 
          src={isOpen ? "/close.png" : "/open.png"} 
          alt={isOpen ? "close-tab" : "open-tab"} 
          onClick={toggleContainer}
        />
      </div>
      
      {isOpen && (
        <>  
          <div className={style.containerInfo}>
            {/* Div para agrupar el texto y el monto */}
            <div>
              <p className={style.textTotal}>Su dinero:</p>
              {/* Lógica condicional para el monto principal */}
              <p className={style.total}> ${areTotalsVisible ? formatNumber(totales.total) : '****'}</p>
            </div>
            {/* Botón del ojo para alternar visibilidad */}
            <button onClick={toggleTotalsVisibility} className={style.visibilityButton}>
              <img  
                className={style.visibilityIcon}
                src={areTotalsVisible ? "/eyeopen.png" : "/eyeclose.png"} 
                alt="Toggle visibility" 
              />
            </button>
          </div>
          <div className={style.containerAllInfo}>
            <div className={style.containerInfoIngreso}>
              <p className={style.containerInfoIngresoIngresoText}>Ingresos</p>
              <img src="/arrow.png" alt="arrow" />
              {/* Lógica condicional para ingresos */}
              <p className={style.containerInfoNumber}>${areTotalsVisible ? formatNumber(totales.ingreso) : '****'}</p>
            </div>
            <div className={style.containerInfoEgreso}>
              <p className={style.containerInfoEgresoEgresoText}>Egresos</p>
              <img src="/arrow.png" alt="arrow" />
              {/* Lógica condicional para egresos */}
              <p className={style.containerInfoNumber}>${areTotalsVisible ? formatNumber(totales.egreso) : '****'}</p>
            </div>
            <div className={style.containerInfoTotal}>
              <p className={style.text}>Total</p>
              <img src="/arrow.png" alt="arrow" />
              {/* Lógica condicional para el total en la lista */}
              <p className={style.containerInfoNumber}>${areTotalsVisible ? formatNumber(totales.total) : '****'}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LeftSite;