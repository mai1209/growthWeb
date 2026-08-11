// Detalle de un reto: portada, meta y mi progreso, unirse/salir, ranking (con
// seguir), info de cómo sumar. El creador tiene menú de ajustes (editar/borrar).
import { useEffect, useState } from "react";
import { FiSettings, FiEdit2, FiTrash2, FiLogOut, FiInfo, FiCalendar, FiArrowLeft } from "react-icons/fi";
import { retosService } from "../../api";
import style from "../../style/Comunidad.module.css";
import CrearRetoModal from "./CrearRetoModal";
import { UserRow } from "./ui";

const DEP_LABEL = { mixto: "Mixto", caminata: "Caminata", carrera: "Carrera", bici: "Bici" };
const km = (m) => (m / 1000).toFixed(1).replace(".", ",");
const fechaCorta = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

export default function RetoDetalleModal({ retoId, retoInicial, miId, onClose, onAbrirPerfil, onCambio }) {
  const [reto, setReto] = useState(retoInicial || null);
  const [ranking, setRanking] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [menu, setMenu] = useState(false);
  const [editar, setEditar] = useState(false);

  const cargar = async () => {
    try {
      const [{ data: dr }, { data: dk }] = await Promise.all([
        retosService.get(retoId),
        retosService.ranking(retoId),
      ]);
      setReto(dr.reto);
      setRanking(dk.ranking || []);
    } catch {
      /* no-op */
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retoId]);

  const unirse = async () => {
    setReto((r) => ({ ...r, meApunto: true, participantes: (r.participantes || 0) + 1 }));
    try {
      await retosService.unirse(retoId);
      onCambio?.();
      cargar();
    } catch {
      setReto((r) => ({ ...r, meApunto: false, participantes: Math.max(0, (r.participantes || 1) - 1) }));
    }
  };

  const salir = async () => {
    setMenu(false);
    setReto((r) => ({ ...r, meApunto: false, participantes: Math.max(0, (r.participantes || 1) - 1) }));
    try {
      await retosService.salir(retoId);
      onCambio?.();
    } catch {
      cargar();
    }
  };

  const borrar = async () => {
    if (!window.confirm("¿Borrar este reto? No se puede deshacer.")) return;
    try {
      await retosService.borrar(retoId);
      onCambio?.();
      onClose?.();
    } catch {
      /* no-op */
    }
  };

  const pct = reto && reto.meta ? Math.min(100, Math.round(((reto.miProgreso || 0) / reto.meta) * 100)) : 0;
  const ini = (reto?.nombre || "?").trim().charAt(0).toUpperCase();

  const acciones = reto?.soyCreador ? (
    <div style={{ position: "relative" }}>
      <button className={style.headerIconBtn} style={{ width: 34, height: 34 }} onClick={() => setMenu((m) => !m)} aria-label="Ajustes">
        <FiSettings />
      </button>
      {menu && (
        <div className={style.menuFlot} style={{ position: "absolute", right: 0, top: "2.4rem" }}>
          <button className={style.menuItem} onClick={() => { setMenu(false); setEditar(true); }}>
            <FiEdit2 /> Editar reto
          </button>
          <button className={`${style.menuItem} ${style.menuItemPeligro}`} onClick={borrar}>
            <FiTrash2 /> Borrar reto
          </button>
        </div>
      )}
    </div>
  ) : reto?.meApunto ? (
    <button className={style.headerIconBtn} style={{ width: 34, height: 34 }} onClick={salir} aria-label="Salir del reto" title="Salir del reto">
      <FiLogOut />
    </button>
  ) : null;

  return (
    <div>
      <div className={style.detalleHead}>
        <button className={style.volverBtn} onClick={onClose} aria-label="Volver">
          <FiArrowLeft />
        </button>
        <span className={style.modalTitulo}>{reto?.nombre || "Reto"}</span>
        <div style={{ marginLeft: "auto" }}>{acciones}</div>
      </div>

      {cargando && !reto ? (
        <div className={style.cargando}>Cargando…</div>
      ) : reto ? (
        <div className={style.modalBody}>
          <div className={style.detalleFotoWrap}>
            <span className={style.detalleFoto}>
              {reto.foto && /^(data:|https?:)/i.test(reto.foto) ? <img src={reto.foto} alt="" /> : ini}
            </span>
          </div>

          <div className={style.detalleCentro}>
            <div className={style.perfilNombre}>{reto.nombre}</div>
            <div className={style.perfilHandle}>
              {DEP_LABEL[reto.deporte] || "Mixto"} · <FiCalendar style={{ verticalAlign: "-2px" }} /> {fechaCorta(reto.inicio)} – {fechaCorta(reto.fin)}
              {" · "}{reto.participantes} {reto.participantes === 1 ? "participante" : "participantes"}
            </div>
          </div>

          {reto.descripcion ? <p className={`${style.descripcion} ${style.detalleCentro}`}>{reto.descripcion}</p> : null}

          {/* Meta + mi progreso */}
          <div className={style.infoCard} style={{ background: "var(--surface-card)", borderColor: "var(--border-color)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
              <span>Meta: {km(reto.meta)} km</span>
              {reto.meApunto && <span style={{ color: "var(--color-verde)" }}>{km(reto.miProgreso || 0)} km · {pct}%</span>}
            </div>
            {reto.meApunto && (
              <div className={style.progreso}>
                <div className={style.progresoFill} style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>

          {!reto.meApunto && (
            <button className={style.btnPrim} onClick={unirse}>Sumarme al reto</button>
          )}

          <div className={style.infoCard}>
            <div className={style.infoTitulo}><FiInfo /> ¿Cómo sumo?</div>
            Registrá tus caminatas, carreras o salidas en bici desde <strong>Movilidad</strong>: los km que hagas dentro de las fechas (y del deporte del reto) suman solos a tu progreso.
          </div>

          {/* Ranking */}
          <div>
            <div className={style.label} style={{ marginBottom: "0.4rem" }}>Ranking</div>
            {ranking === null ? (
              <div className={style.cargando} style={{ padding: "0.6rem" }}>Cargando…</div>
            ) : ranking.length === 0 ? (
              <div className={style.vacio}>Todavía nadie sumó km.</div>
            ) : (
              ranking.map((u, i) => (
                <UserRow
                  key={u.id}
                  user={u}
                  pos={i + 1}
                  onAbrirPerfil={onAbrirPerfil}
                  extra={<span className={style.itemBadge}>{km(u.metros)} km</span>}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <div className={style.error} style={{ padding: "2rem" }}>No se pudo cargar el reto.</div>
      )}

      {editar && (
        <CrearRetoModal
          reto={reto}
          onClose={() => setEditar(false)}
          onGuardado={(r) => { setReto((prev) => ({ ...prev, ...r })); onCambio?.(); }}
        />
      )}
    </div>
  );
}
