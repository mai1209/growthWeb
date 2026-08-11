// Tarjeta de posteo reutilizable (feed, perfil, club): cabecera + texto/foto +
// bloque de actividad (si no hay foto) + kudos + comentarios desplegables.
import { useState } from "react";
import {
  FiThumbsUp,
  FiMessageCircle,
  FiMoreHorizontal,
  FiSend,
  FiTrash2,
} from "react-icons/fi";
import { MdDirectionsWalk, MdDirectionsRun, MdDirectionsBike } from "react-icons/md";
import { communityService } from "../../api";
import style from "../../style/Comunidad.module.css";
import { Avatar, haceCuanto } from "./ui";

const ACT = {
  caminata: { label: "Caminata", Icon: MdDirectionsWalk },
  carrera: { label: "Carrera", Icon: MdDirectionsRun },
  bici: { label: "Bici", Icon: MdDirectionsBike },
};
const actMeta = (t) => ACT[t] || ACT.caminata;

// Imagen adaptativa (estilo Instagram): no se recorta, se ajusta a su
// proporción real al cargar (con tope para retratos muy altos).
function FotoPost({ uri }) {
  const [ratio, setRatio] = useState(null);
  return (
    <img
      src={uri}
      alt="Foto del posteo"
      className={style.postFoto}
      style={ratio ? { aspectRatio: ratio } : { height: 260 }}
      onLoad={(e) => {
        const { naturalWidth: w, naturalHeight: h } = e.target;
        if (w && h) setRatio(Math.min(1.91, Math.max(0.8, w / h)));
      }}
    />
  );
}

export default function PostCard({ post, miId, onAbrirPerfil, onBorrar }) {
  const [p, setP] = useState(post);
  const [abierto, setAbierto] = useState(false);
  const [comentarios, setComentarios] = useState(null); // null = no cargados
  const [cargandoCom, setCargandoCom] = useState(false);
  const [nuevoCom, setNuevoCom] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [menu, setMenu] = useState(false);

  const soyAutor = p.autor && String(p.autor.id) === String(miId);

  const toggleKudos = async () => {
    const antes = { leDiKudos: p.leDiKudos, kudos: p.kudos };
    setP((x) => ({
      ...x,
      leDiKudos: !x.leDiKudos,
      kudos: x.kudos + (x.leDiKudos ? -1 : 1),
    }));
    try {
      await communityService.kudos(p.id);
    } catch {
      setP((x) => ({ ...x, ...antes }));
    }
  };

  const toggleComentarios = async () => {
    const abrir = !abierto;
    setAbierto(abrir);
    if (abrir && comentarios === null) {
      setCargandoCom(true);
      try {
        const { data } = await communityService.comentarios(p.id);
        setComentarios(data.comentarios || []);
      } catch {
        setComentarios([]);
      } finally {
        setCargandoCom(false);
      }
    }
  };

  const enviarComentario = async (e) => {
    e.preventDefault();
    const txt = nuevoCom.trim();
    if (!txt || enviando) return;
    setEnviando(true);
    try {
      const { data } = await communityService.comentar(p.id, txt);
      setComentarios((c) => [...(c || []), data.comentario]);
      setP((x) => ({ ...x, comentarios: (x.comentarios || 0) + 1 }));
      setNuevoCom("");
    } catch {
      /* no-op */
    } finally {
      setEnviando(false);
    }
  };

  const borrarComentario = async (id) => {
    setComentarios((c) => (c || []).filter((x) => x.id !== id));
    setP((x) => ({ ...x, comentarios: Math.max(0, (x.comentarios || 0) - 1) }));
    try {
      await communityService.borrarComentario(id);
    } catch {
      /* no-op */
    }
  };

  const { Icon, label } = actMeta(p.actividad?.tipo);
  // Solo mostramos fotos que la web puede cargar (data URI o URL). Las viejas
  // guardadas como ruta local del teléfono (/private/var/…) se ignoran.
  const fotoWeb = p.foto && /^(data:|https?:)/i.test(p.foto) ? p.foto : "";

  return (
    <article className={style.post}>
      <div className={style.postHead}>
        <Avatar user={p.autor} onClick={() => p.autor && onAbrirPerfil?.(p.autor)} />
        <div className={style.postAutor}>
          <button className={style.postNombre} onClick={() => p.autor && onAbrirPerfil?.(p.autor)}>
            {p.autor?.fullName || p.autor?.username || "Alguien"}
          </button>
          <span className={style.postMeta}>
            @{p.autor?.username} · {haceCuanto(p.createdAt)}
          </span>
        </div>
        {soyAutor && (
          <div style={{ position: "relative", marginLeft: "auto" }}>
            <button className={style.postMenuBtn} onClick={() => setMenu((m) => !m)} aria-label="Opciones">
              <FiMoreHorizontal />
            </button>
            {menu && (
              <div className={style.menuFlot} style={{ position: "absolute", right: 0, top: "2rem", minWidth: 150 }}>
                <button
                  className={`${style.menuItem} ${style.menuItemPeligro}`}
                  onClick={() => {
                    setMenu(false);
                    onBorrar?.(p.id);
                  }}
                >
                  <FiTrash2 /> Borrar posteo
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {p.texto ? <p className={style.postTexto}>{p.texto}</p> : null}
      {fotoWeb ? <FotoPost uri={fotoWeb} /> : null}
      {p.tipo === "actividad" && p.actividad && !fotoWeb ? (
        <div className={style.actividad}>
          <div className={style.actIcono}>
            <Icon />
          </div>
          <div className={style.actDatos}>
            <div className={style.actDato}>
              <div className={style.actValor}>{((p.actividad.metros || 0) / 1000).toFixed(2)}</div>
              <div className={style.actLabel}>km</div>
            </div>
            <div className={style.actDato}>
              <div className={style.actValor}>{Math.floor((p.actividad.secs || 0) / 60)}</div>
              <div className={style.actLabel}>min</div>
            </div>
            <div className={style.actDato}>
              <div className={style.actValor}>{label}</div>
              <div className={style.actLabel}>tipo</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className={style.postAcciones}>
        <button className={`${style.accionBtn} ${p.leDiKudos ? style.accionOn : ""}`} onClick={toggleKudos}>
          <FiThumbsUp />
          {p.kudos > 0 ? `${p.kudos} ` : ""}
          {p.kudos === 1 ? "kudo" : "kudos"}
        </button>
        <button className={style.accionBtn} onClick={toggleComentarios}>
          <FiMessageCircle />
          {p.comentarios > 0 ? `${p.comentarios} ` : ""}
          coment.
        </button>
      </div>

      {abierto && (
        <div className={style.comentarios}>
          {cargandoCom ? (
            <div className={style.cargando} style={{ padding: "0.6rem" }}>Cargando…</div>
          ) : (
            (comentarios || []).map((c) => (
              <div key={c.id} className={style.comentario}>
                <Avatar user={c.autor} className={style.avatarSm} onClick={() => c.autor && onAbrirPerfil?.(c.autor)} />
                <div className={style.comentBody}>
                  <div className={style.comentNombre}>{c.autor?.fullName || c.autor?.username}</div>
                  <div className={style.comentTexto}>{c.texto}</div>
                </div>
                {c.autor && String(c.autor.id) === String(miId) && (
                  <button className={style.comentBorrar} onClick={() => borrarComentario(c.id)} aria-label="Borrar">
                    <FiTrash2 />
                  </button>
                )}
              </div>
            ))
          )}
          <form
            className={style.comentForm}
            onSubmit={enviarComentario}
            style={{ display: "flex", flexDirection: "row", flexWrap: "nowrap", alignItems: "center", gap: "0.5rem", width: "100%" }}
          >
            <input
              className={style.comentInput}
              placeholder="Escribí un comentario…"
              value={nuevoCom}
              onChange={(e) => setNuevoCom(e.target.value)}
              maxLength={300}
              style={{ flex: "1 1 0", minWidth: 0, width: "auto", margin: 0, maxWidth: "none" }}
            />
            <button
              className={style.comentEnviar}
              type="submit"
              disabled={!nuevoCom.trim() || enviando}
              style={{ flex: "0 0 38px", margin: 0 }}
            >
              <FiSend />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
