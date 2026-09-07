import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiCheck,
  FiPlay,
  FiSquare,
  FiStar,
  FiSun,
  FiTrash2,
} from "react-icons/fi";
import { afirmacionService } from "../api";
import style from "../style/Afirmaciones.module.css";

const RENGLONES_INICIALES = 5;
const MAX_RENGLONES = 30;

// Tintes de las tarjetas del carrusel (paleta de la app, rotan en orden)
const CARD_TINTS = ["#9cfb43", "#58eba4", "#ffd55c", "#69a7ff", "#f070b8"];

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
  // Renglones resaltados (fijos): se prenden/apagan al hacer click en el número.
  const [resaltadas, setResaltadas] = useState(() => new Set());

  const toggleResaltada = (indice) => {
    const next = new Set(resaltadas);
    if (next.has(indice)) next.delete(indice);
    else next.add(indice);
    setResaltadas(next);
    // Se guarda en el server para sincronizar con la app.
    afirmacionService.save({ resaltadas: [...next], fecha }).catch(() => {});
  };
  const guardadoRef = useRef(null);

  const aplicarRespuesta = useCallback((data) => {
    const recibidas = Array.isArray(data?.lineas) ? data.lineas : [];
    // Siempre mostramos al menos los renglones iniciales, aunque vengan vacíos.
    const completas =
      recibidas.length >= RENGLONES_INICIALES
        ? recibidas
        : [...recibidas, ...Array(RENGLONES_INICIALES - recibidas.length).fill("")];
    setLineas(completas);
    setResaltadas(new Set(Array.isArray(data?.resaltadas) ? data.resaltadas : []));
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

  // Borra TODAS las afirmaciones y arranca de cero (con confirmación).
  const resetearAfirmaciones = () => {
    const ok = window.confirm(
      "Se borrarán TODAS las afirmaciones para empezar de nuevo."
    );
    if (!ok) return;
    const vacias = Array(RENGLONES_INICIALES).fill("");
    setLineas(vacias);
    setResaltadas(new Set());
    if (guardadoRef.current) clearTimeout(guardadoRef.current);
    afirmacionService.save({ lineas: vacias, resaltadas: [], fecha }).catch(() => {});
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

  // ---- Grilla de tarjetas: se escribe directo sobre la card ----
  // La primera línea vacía hace de "Escribí tu afirmación…"; si no queda
  // ninguna vacía, agregamos un renglón solo para que siempre haya una card
  // donde escribir (hasta el máximo).
  const primeraVacia = useMemo(() => lineas.findIndex((l) => !l.trim()), [lineas]);
  useEffect(() => {
    if (primeraVacia === -1 && lineas.length < MAX_RENGLONES) {
      setLineas((prev) => {
        if (prev.some((l) => !l.trim()) || prev.length >= MAX_RENGLONES) return prev;
        return [...prev, ""];
      });
    }
  }, [primeraVacia, lineas.length]);

  // ---- Voz: leer las afirmaciones en voz alta con la voz del navegador ----
  const [hablando, setHablando] = useState(false);
  const [leyendoIdx, setLeyendoIdx] = useState(null);
  const pausaRef = useRef(null);

  const detenerVoz = useCallback(() => {
    if (pausaRef.current) clearTimeout(pausaRef.current);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setHablando(false);
    setLeyendoIdx(null);
  }, []);

  const escucharAfirmaciones = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (hablando) {
      detenerVoz();
      return;
    }
    const items = lineas
      .map((linea, i) => ({ texto: linea.trim(), i }))
      .filter((x) => x.texto);
    if (!items.length) return;
    window.speechSynthesis.cancel();
    setHablando(true);
    let k = 0;
    const siguiente = () => {
      if (k >= items.length) {
        setHablando(false);
        setLeyendoIdx(null);
        return;
      }
      const { texto, i } = items[k];
      setLeyendoIdx(i);
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = "es-AR";
      u.rate = 0.82;
      u.onend = () => {
        k += 1;
        // Pausa mínima entre afirmaciones para que respire.
        pausaRef.current = setTimeout(siguiente, 550);
      };
      u.onerror = () => {
        setHablando(false);
        setLeyendoIdx(null);
      };
      window.speechSynthesis.speak(u);
    };
    siguiente();
  }, [hablando, lineas, detenerVoz]);

  // Corta la voz si se desmonta el componente.
  useEffect(
    () => () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    },
    []
  );

  // Cuando se leen en voz alta, la vista sigue a la tarjeta que suena.
  useEffect(() => {
    if (leyendoIdx == null) return;
    document
      .getElementById(`afir-card-${leyendoIdx}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [leyendoIdx]);

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
            className={`${style.playBtn} ${hablando ? style.playBtnOn : ""}`}
            onClick={escucharAfirmaciones}
            disabled={!hayEscritas}
            title={hablando ? "Detener la lectura" : "Escuchar tus afirmaciones"}
          >
            {hablando ? <FiSquare /> : <FiPlay />}
            {hablando ? "Detener" : "Escuchar"}
          </button>

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

          <button
            type="button"
            className={style.resetBtn}
            onClick={resetearAfirmaciones}
            title="Borrar todas las afirmaciones y empezar de nuevo"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Grilla de tarjetas: cada afirmación ES la card, y se escribe directo
          encima. La card punteada del final es "Escribí tu afirmación…". */}
      <div className={style.cartasGrid}>
        {lineas.map((linea, i) => {
          const escrita = Boolean(linea.trim());
          // Las vacías no se muestran, salvo la primera: esa es la card de escribir
          if (!escrita && i !== primeraVacia) return null;
          const tint = CARD_TINTS[i % CARD_TINTS.length];
          return (
            <div
              key={i}
              id={`afir-card-${i}`}
              className={`${style.cartaG} ${escrita ? "" : style.cartaGVacia} ${
                leyendoIdx === i ? style.cartaLeyendo : ""
              }`}
              style={
                escrita
                  ? {
                      background: `${tint}1f`,
                      borderColor: `${tint}59`,
                      boxShadow: resaltadas.has(i) ? `0 0 22px ${tint}73` : undefined,
                    }
                  : undefined
              }
            >
              <textarea
                className={style.cartaInput}
                value={linea}
                rows={1}
                placeholder="Escribí tu afirmación…"
                onChange={(e) => editarLinea(i, e.target.value)}
                // El alto se recalcula en cada render (no solo al tipear):
                // sin esto, las afirmaciones largas aparecían cortadas al cargar.
                ref={(el) => {
                  if (!el) return;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
              />
              {escrita ? (
                <>
                  <button
                    type="button"
                    className={`${style.cartaResaltar} ${
                      resaltadas.has(i) ? style.cartaResaltarOn : ""
                    }`}
                    style={resaltadas.has(i) ? { color: tint } : undefined}
                    onClick={() => toggleResaltada(i)}
                    title={resaltadas.has(i) ? "Quitar resaltado" : "Resaltar esta afirmación"}
                    aria-pressed={resaltadas.has(i)}
                  >
                    <FiStar />
                  </button>
                  {lineas.length > 1 ? (
                    <button
                      type="button"
                      className={style.cartaBorrar}
                      onClick={() => borrarLinea(i)}
                      aria-label="Borrar afirmación"
                      title="Borrar afirmación"
                    >
                      <FiTrash2 />
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      <span className={style.guardando}>{guardando ? "Guardando…" : ""}</span>

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
        <span className={style.leerCirculo}>{leidoHoy ? <FiCheck /> : null}</span>
        {leidoHoy ? "Leídas hoy" : "Leí mis afirmaciones de hoy"}
      </button>
    </div>
  );
}

export default Afirmaciones;
