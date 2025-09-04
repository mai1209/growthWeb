// LeftSite.js (CORREGIDO Y COMPLETO)

import { useState, useEffect } from 'react';
import style from '../style/LeftSite.module.css';

// 1. El componente recibe la lista de 'movimientos' como una prop desde App.js
function LeftSite({ movimientos }) {
  const [isOpen, setIsOpen] = useState(true);
  const [totales, setTotales] = useState({ ingreso: 0, egreso: 0, total: 0 });

  const toggleContainer = () => setIsOpen(!isOpen);

  // 2. ELIMINAMOS POR COMPLETO el useEffect que usaba 'axios'.
  //    La responsabilidad de buscar los datos ahora es de App.js.

  // 3. Este useEffect se queda, porque su trabajo es CALCULAR los totales
  //    cada vez que la lista de 'movimientos' (que viene de las props) cambia.
  useEffect(() => {
    if (movimientos && movimientos.length > 0) {
      const ingreso = movimientos
        .filter(m => m.tipo === "ingreso")
        .reduce((acc, cur) => acc + Number(cur.monto), 0);

      const egreso = movimientos
        .filter(m => m.tipo === "egreso")
        .reduce((acc, cur) => acc + Number(cur.monto), 0);

      setTotales({
        ingreso,
        egreso,
        total: ingreso - egreso
      });
    } else {
      // Si no hay movimientos, reseteamos los totales a cero.
      setTotales({ ingreso: 0, egreso: 0, total: 0 });
    }
  }, [movimientos]); // Se ejecuta cuando la prop 'movimientos' cambia

  // Función para formatear números
  const formatNumber = (num) => 
    num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className={`${style.container} ${!isOpen ? style.closed : ''}`}>
      <div className={style.containerOpenClose}>
        <img 
          className={style.close} 
          src={isOpen ? "./close.png" : "./open.png"} 
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
              <img src="./arrow.png" alt="arrow" />
              <p className={style.containerInfoNumber}>${formatNumber(totales.ingreso)}</p>
            </div>
            <div className={style.containerInfoEgreso}>
              <p className={style.containerInfoEgresoEgresoText}>Egresos</p>
              <img src="./arrow.png" alt="arrow" />
              <p className={style.containerInfoNumber}>${formatNumber(totales.egreso)}</p>
            </div>
            <div className={style.containerInfoTotal}>
              <p className={style.text}>Total</p>
              <img src="./arrow.png" alt="arrow" />
              <p className={style.containerInfoNumber}>${formatNumber(totales.total)}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LeftSite;