import { useState, useEffect } from "react";
import axios from "axios";
import style from "../style/LeftSite.module.css";

function LeftSite({ token, refreshKey }) {
  const [viewMode, setViewMode] = useState("total"); // total | month
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Visibilidad de montos
  const [areTotalsVisible, setAreTotalsVisible] = useState(true);

  const [movimientos, setMovimientos] = useState([]);
  const [totales, setTotales] = useState({
    ingreso: 0,
    egreso: 0,
    total: 0,
  });

  const API_URL =
    process.env.REACT_APP_API_URL || "http://localhost:3000";

  const toggleTotalsVisibility = () => {
    setAreTotalsVisible((prev) => !prev);
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
        console.error("Error al obtener movimientos:", err);
        setMovimientos([]);
      }
    };

    fetchMovimientos();
  }, [token, refreshKey, API_URL]);

  useEffect(() => {
    let data = movimientos;

    if (viewMode === "month") {
      const month = selectedMonth.getMonth();
      const year = selectedMonth.getFullYear();

      data = movimientos.filter((m) => {
        const date = new Date(m.fecha);
        return (
          date.getMonth() === month &&
          date.getFullYear() === year
        );
      });
    }

    const ingreso = data
      .filter((m) => m.tipo === "ingreso")
      .reduce((acc, cur) => acc + Number(cur.monto), 0);

    const egreso = data
      .filter((m) => m.tipo === "egreso")
      .reduce((acc, cur) => acc + Number(cur.monto), 0);

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
      <div className={style.firstContainer}>
        <div className={style.containerInfo}>
          <div>
            <p className={style.textTotal}>Su dinero:</p>
            <p className={style.total}>
              ${areTotalsVisible
                ? formatNumber(totales.total)
                : "****"}
            </p>
          </div>

          <button
            onClick={toggleTotalsVisibility}
            className={style.visibilityButton}
          >
            <img
              className={style.visibilityIcon}
              src={
                areTotalsVisible
                  ? "/eyeopen.png"
                  : "/eyeclose.png"
              }
              alt="Toggle visibility"
            />
          </button>
        </div>

        <div className={style.containerAllInfo}>
          <div className={style.containerInfoIngreso}>
            <p className={style.containerInfoIngresoIngresoText}>
              Ingresos
            </p>
            <img src="/arrow.png" alt="arrow" />
            <p className={style.containerInfoNumber}>
              ${areTotalsVisible
                ? formatNumber(totales.ingreso)
                : "****"}
            </p>
          </div>

          <div className={style.containerInfoEgreso}>
            <p className={style.containerInfoEgresoEgresoText}>
              Egresos
            </p>
            <img src="/arrow.png" alt="arrow" />
            <p className={style.containerInfoNumber}>
              ${areTotalsVisible
                ? formatNumber(totales.egreso)
                : "****"}
            </p>
          </div>

          <div className={style.containerInfoTotal}>
            <p className={style.text}>Total</p>
            <img src="/arrow.png" alt="arrow" />
            <p className={style.containerInfoNumber}>
              ${areTotalsVisible
                ? formatNumber(totales.total)
                : "****"}
            </p>
          </div>
        </div>

        <div className={style.viewMode}>
          <button
            className={viewMode === "total" ? style.active : ""}
            onClick={() => setViewMode("total")}
          >
            Resumen Histórico
          </button>

          <button
            className={viewMode === "month" ? style.active : ""}
            onClick={() => setViewMode("month")}
          >
            Resumen del mes
          </button>

          {viewMode === "month" && (
            <input
              type="month"
              value={`${selectedMonth.getFullYear()}-${String(
                selectedMonth.getMonth() + 1
              ).padStart(2, "0")}`}
              onChange={(e) => {
                const [year, month] =
                  e.target.value.split("-");
                setSelectedMonth(
                  new Date(year, month - 1)
                );
              }}
              className={style.monthPicker}
            />
          )}
        </div>
      </div>

      <div className={style.containerImg}>
        <img
          className={style.imgLeft}
          src="./imgCelu.jpg"
          alt=""
        />
      </div>
    </div>
  );
}

export default LeftSite;
