import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiCheck, FiPlus, FiSun, FiTrash2 } from "react-icons/fi";
import { afirmacionService } from "../api";
import style from "../style/Afirmaciones.module.css";

const RENGLONES_INICIALES = 5;
const MAX_RENGLONES = 30;

// Fecha local del navegador en formato YYYY-MM-DD. No usamos toISOString() a
// secas porque eso devuelve UTC y a la noche te cambia el día antes de tiempo.
const hoyLocal = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const fechaLarga = (fecha) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

function Afirmaciones() {
  const [fecha, setFecha] = useState(hoyLocal);
  const [lineas, setLineas] = useState(() => Array(RENGLONES_INICIALES).fill(""));
  const [leidoHoy, setLeidoHoy] = useState(false);
  const [racha, setRacha] = useState(0);
  const [repetirDiario, setRepetirDiario] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const guardadoRef = useRef(null);

  const aplicarRespuesta = useCallback((data) => {
    const recibidas = Array.isArray(data?.lineas) ? data.lineas : [];
    // Siempre mostramos al menos los renglones iniciales, aunque vengan vacíos.
    const completas =
      recibidas.length >= RENGLONES_INICIALES
        ? recibidas
        : [...recibidas, ...Array(RENGLONES_INICIALES - recibidas.length).fill("")];
    setLineas(completas);
    setLeidoHoy(Boolean(data?.leidoHoy));
    setRacha(Number(data?.racha) || 0);
    setRepetirDiario(data?.repetirDiario !== false);
  }, []);

  const cargar = useCallback(
    async (fechaObjetivo) => {
      try {
        const { data } = await afirmacionService.get(fechaObjetivo);
        aplicarRespuesta(data);
      } catch {
        /* si falla dejamos lo que haya en pantalla */
      } finally {
        setCargando(false);
      }
    },
    [aplicarRespuesta]
  );

  useEffect(() => {
    cargar(fecha);
  }, [cargar, fecha]);

  // Si la pestaña queda abierta y cruza la medianoche, al volver refrescamos el
  // día: cambia la fecha de arriba y el botón vuelve a estar disponible.
  useEffect(() => {
    const revisarDia = () => {
      const actual = hoyLocal();
      setFecha((prev) => (prev === actual ? prev : actual));
    };
    window.addEventListener("focus", revisarDia);
    document.addEventListener("visibilitychange", revisarDia);
    const timer = setInterval(revisarDia, 60000);
    return () => {
      window.removeEventListener("focus", revisarDia);
      document.removeEventListener("visibilitychange", revisarDia);
      clearInterval(timer);
    };
  }, []);

  // Autoguardado: no hay botón de "guardar", se persiste solo al dejar de tipear.
  const guardarDiferido = useCallback(
    (proximas) => {
      if (guardadoRef.current) clearTimeout(guardadoRef.current);
      guardadoRef.current = setTimeout(async () => {
        setGuardando(true);
        try {
          await afirmacionService.save({ lineas: proximas, fecha });
        } catch {
          /* reintenta en la próxima edición */
        } finally {
          setGuardando(false);
        }
      }, 800);
    },
    [fecha]
  );

  useEffect(() => () => guardadoRef.current && clearTimeout(guardadoRef.current), []);

  const editarLinea = (indice, valor) => {
    setLineas((prev) => {
      const proximas = prev.map((linea, i) => (i === indice ? valor : linea));
      guardarDiferido(proximas);
      return proximas;
    });
  };

  const agregarLinea = () => {
    setLineas((prev) => {
      if (prev.length >= MAX_RENGLONES) return prev;
      const proximas = [...prev, ""];
      guardarDiferido(proximas);
      return proximas;
    });
  };

  const borrarLinea = (indice) => {
    setLineas((prev) => {
      if (prev.length <= 1) return prev;
      const proximas = prev.filter((_, i) => i !== indice);
      guardarDiferido(proximas);
      return proximas;
    });
  };

  const hayEscritas = useMemo(() => lineas.some((l) => l.trim()), [lineas]);

  const alternarRepetir = async () => {
    const proximo = !repetirDiario;
    setRepetirDiario(proximo); // optimista
    try {
      await afirmacionService.save({ repetirDiario: proximo, fecha });
    } catch {
      setRepetirDiario(!proximo); // si falló, volvemos al estado real
    }
  };

  const alternarLeido = async () => {
    const previo = leidoHoy;
    setLeidoHoy(!previo); // optimista: el tilde responde al toque al instante
    try {
      const { data } = previo
        ? await afirmacionService.desmarcarLeido(fecha)
        : await afirmacionService.marcarLeido(fecha);
      setLeidoHoy(Boolean(data?.leidoHoy));
      setRacha(Number(data?.racha) || 0);
    } catch {
      setLeidoHoy(previo); // si falló, volvemos al estado real
    }
  };

  if (cargando) {
    return <p className={style.cargando}>Cargando tus afirmaciones…</p>;
  }

  return (
    <div className={style.wrap}>
      <header className={style.header}>
        <div className={style.fechaBloque}>
          <FiSun className={style.fechaIcono} />
          <span className={style.fecha}>{fechaLarga(fecha)}</span>
        </div>
        <div className={style.headerAcciones}>
          {racha > 0 ? (
            <span className={style.racha} title={`${racha} días seguidos leyendo tus afirmaciones`}>
              🔥 {racha} {racha === 1 ? "día" : "días"}
            </span>
          ) : null}

          <button
            type="button"
            role="switch"
            aria-checked={repetirDiario}
            className={`${style.switch} ${repetirDiario ? style.switchOn : ""}`}
            onClick={alternarRepetir}
            title={
              repetirDiario
                ? "Mañana vas a encontrar estas mismas afirmaciones"
                : "Mañana vas a empezar con los renglones vacíos"
            }
          >
            <span className={style.switchPista}>
              <span className={style.switchBolita} />
            </span>
            Guardarlas al día siguiente
          </button>
        </div>
      </header>

      <p className={style.ayuda}>
        {repetirDiario
          ? "Escribí tus afirmaciones y leelas todos los días. Mañana van a estar acá mismo: podés editarlas cuando quieras."
          : "Cada día vas a empezar con los renglones vacíos. Lo que escribas hoy se guarda igual, no se pierde."}
      </p>

      <ol className={style.lista}>
        {lineas.map((linea, indice) => (
          <li key={indice} className={style.item}>
            <span className={style.numero}>{indice + 1}</span>
            <textarea
              className={style.input}
              value={linea}
              rows={1}
              placeholder="Escribí tu afirmación…"
              onChange={(e) => editarLinea(indice, e.target.value)}
              onInput={(e) => {
                // Autoajuste de alto para que las afirmaciones largas se lean enteras.
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
            />
            {lineas.length > 1 ? (
              <button
                type="button"
                className={style.borrar}
                onClick={() => borrarLinea(indice)}
                aria-label={`Borrar renglón ${indice + 1}`}
                title="Borrar renglón"
              >
                <FiTrash2 />
              </button>
            ) : null}
          </li>
        ))}
      </ol>

      <div className={style.acciones}>
        <button
          type="button"
          className={style.agregar}
          onClick={agregarLinea}
          disabled={lineas.length >= MAX_RENGLONES}
        >
          <FiPlus />
          Agregar renglón
        </button>
        <span className={style.guardando}>{guardando ? "Guardando…" : ""}</span>
      </div>

      <button
        type="button"
        className={`${style.leer} ${leidoHoy ? style.leerHecho : ""}`}
        onClick={alternarLeido}
        disabled={!hayEscritas}
        title={
          !hayEscritas
            ? "Escribí al menos una afirmación"
            : leidoHoy
            ? "Tocá para desmarcar"
            : "Marcá que ya las leíste"
        }
      >
        {leidoHoy ? (
          <>
            <FiCheck />
            Leídas hoy
          </>
        ) : (
          "Leí mis afirmaciones de hoy"
        )}
      </button>
    </div>
  );
}

export default Afirmaciones;
