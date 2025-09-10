// LeftSite.jsx (CORREGIDO Y FINAL)

import { useState, useEffect } from 'react';
import axios from 'axios'; // <-- Necesitamos axios aquí
import style from '../style/LeftSite.module.css';

// 1. Ahora recibe 'token' y 'refreshKey' para poder buscar sus datos
function LeftSite({ token, refreshKey }) {
  const [isOpen, setIsOpen] = useState(true);
  const [movimientos, setMovimientos] = useState([]); // Vuelve a tener su propio estado de movimientos
  const [totales, setTotales] = useState({ ingreso: 0, egreso: 0, total: 0 });

  const toggleContainer = () => setIsOpen(!isOpen);
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

  // 2. Este useEffect AHORA busca los datos desde la API
  useEffect(() => {
    const fetchMovimientos = async () => {
      // Si no hay token, no hace nada y los movimientos quedan en cero
      if (!token) {
        setMovimientos([]);
        return;
      }
      try {
        // Pide TODOS los movimientos (sin filtro de fecha)
        const res = await axios.get(`${API_URL}/api/add`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMovimientos(res.data); // Guarda los datos en su propio estado
      } catch (err) {
        console.error("Error al obtener movimientos en LeftSite:", err);
        setMovimientos([]); // Si hay error, la lista queda vacía
      }
    };
    fetchMovimientos();
  }, [token, refreshKey]); // Se ejecuta al inicio y cada vez que refreshKey cambia

  // 3. Este useEffect se queda igual, calcula los totales cuando 'movimientos' cambia
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
            <p className={style.textTotal}>Su dinero:</p>
            <p className={style.total}> ${formatNumber(totales.total)}</p>
          </div>
          <div className={style.containerAllInfo}>
            <div className={style.containerInfoIngreso}>
              <p className={style.containerInfoIngresoIngresoText}>Ingresos</p>
              <img src="/arrow.png" alt="arrow" />
              <p className={style.containerInfoNumber}>${formatNumber(totales.ingreso)}</p>
            </div>
            <div className={style.containerInfoEgreso}>
              <p className={style.containerInfoEgresoEgresoText}>Egresos</p>
              <img src="/arrow.png" alt="arrow" />
              <p className={style.containerInfoNumber}>${formatNumber(totales.egreso)}</p>
            </div>
            <div className={style.containerInfoTotal}>
              <p className={style.text}>Total</p>
              <img src="/arrow.png" alt="arrow" />
              <p className={style.containerInfoNumber}>${formatNumber(totales.total)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LeftSite;