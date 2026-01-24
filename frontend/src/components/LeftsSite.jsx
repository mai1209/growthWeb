import { useState, useEffect } from "react";
import style from "../style/LeftSite.module.css";
import { movimientoService } from "../api";

function LeftSite({ refreshKey }) {
  const [viewMode, setViewMode] = useState("total");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [areTotalsVisible, setAreTotalsVisible] = useState(true);
  const [movimientos, setMovimientos] = useState([]);
  const [totales, setTotales] = useState({ ingreso: 0, egreso: 0, total: 0 });

  //const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";

  const toggleTotalsVisibility = () => setAreTotalsVisible((prev) => !prev);

 useEffect(() => {
 {
  let isMounted = true;

  const fetchMovimientos = async () => {
    // 1. Verificamos que exista el token en el storage antes de pedir
    const storedToken = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!storedToken) return;

    try {
      // 2. ¡OJO ACÁ!: Ya NO pases 'token' por paréntesis. 
      // El interceptor lo saca solo del localStorage.
      const res = await movimientoService.getAll(); 
      
      if (isMounted && res.data) {
        setMovimientos(res.data);
      }
    } catch (err) {
      // El error 401 ya lo maneja el interceptor (te redirige solo)
      // Acá solo manejamos errores de conexión o del servidor
      console.error("Error al obtener movimientos:", err.message);
    }
  };

  fetchMovimientos();
  return () => { isMounted = false; };
  };


}, [refreshKey]);

  // 2. ÚNICO efecto para calcular totales (LÓGICA)
  useEffect(() => {
    // Si no hay movimientos, reseteamos totales a 0 y salimos
    if (!movimientos || movimientos.length === 0) {
      setTotales({ ingreso: 0, egreso: 0, total: 0 });
      return;
    }

    let data = movimientos;

    if (viewMode === "month") {
      const month = selectedMonth.getMonth();
      const year = selectedMonth.getFullYear();

      data = movimientos.filter((m) => {
        // Validamos que el movimiento tenga fecha para evitar el error que mencionas
        if (!m.fecha || typeof m.fecha !== "string") return false;

        const [y, mStr] = m.fecha.split(/[-T/]/);
        return parseInt(y) === year && (parseInt(mStr) - 1) === month;
      });
    }

    const ingreso = data
      .filter((m) => m.tipo === "ingreso")
      .reduce((acc, cur) => acc + Number(cur.monto || 0), 0);

    const egreso = data
      .filter((m) => m.tipo === "egreso")
      .reduce((acc, cur) => acc + Number(cur.monto || 0), 0);

    setTotales({
      ingreso,
      egreso,
      total: ingreso - egreso,
    });
  }, [movimientos, viewMode, selectedMonth]); 

  const formatNumber = (num) =>
    num.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className={style.container}>
      {/* ... todo tu JSX de renderizado igual que antes ... */}
      <div className={style.firstContainer}>
        <div className={style.containerInfo}>
          <div>
            <p className={style.textTotal}>Su dinero:</p>
            <p className={style.total}>
              ${areTotalsVisible ? formatNumber(totales.total) : "****"}
            </p>
          </div>
          <button onClick={toggleTotalsVisibility} className={style.visibilityButton}>
            <img 
              className={style.visibilityIcon} 
              src={areTotalsVisible ? "/eyeopen.png" : "/eyeclose.png"} 
              alt="Toggle" 
            />
          </button>
        </div>

        <div className={style.containerAllInfo}>
          <div className={style.containerInfoIngreso}>
            <p className={style.containerInfoIngresoIngresoText}>Ingresos</p>
            <img src="/arrow.png" alt="arrow" />
            <p className={style.containerInfoNumber}>
              ${areTotalsVisible ? formatNumber(totales.ingreso) : "****"}
            </p>
          </div>
          <div className={style.containerInfoEgreso}>
            <p className={style.containerInfoEgresoEgresoText}>Egresos</p>
            <img src="/arrow.png" alt="arrow" />
            <p className={style.containerInfoNumber}>
              ${areTotalsVisible ? formatNumber(totales.egreso) : "****"}
            </p>
          </div>
          <div className={style.containerInfoTotal}>
            <p className={style.text}>Total</p>
            <img src="/arrow.png" alt="arrow" />
            <p className={style.containerInfoNumber}>
              ${areTotalsVisible ? formatNumber(totales.total) : "****"}
            </p>
          </div>
        </div>

        <div className={style.viewMode}>
          <button className={viewMode === "total" ? style.active : ""} onClick={() => setViewMode("total")}>
            Resumen Histórico
          </button>
          <button className={viewMode === "month" ? style.active : ""} onClick={() => setViewMode("month")}>
            Resumen del mes
          </button>
          {viewMode === "month" && (
            <input
              type="month"
              value={`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, "0")}`}
              onChange={(e) => {
                const [year, month] = e.target.value.split("-");
                setSelectedMonth(new Date(year, month - 1));
              }}
              className={style.monthPicker}
            />
          )}
        </div>
      </div>
      <div className={style.containerImg}>
        <img className={style.imgLeft} src="./imgCelu.jpg" alt="" />
      </div>
    </div>
  );
}

export default LeftSite;