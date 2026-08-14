// Perfil público de un usuario: portada + stats + seguir/dejar de seguir + sus
// posteos. Mismo formato para uno mismo y para otros.
import { useEffect, useState } from "react";
import { FiMessageCircle } from "react-icons/fi";
import { communityService } from "../../api";
import style from "../../style/Comunidad.module.css";
import Modal from "./Modal";
import PostCard from "./PostCard";
import ListaUsuariosModal from "./ListaUsuariosModal";
import ChatModal from "./ChatModal";

export default function PerfilModal({ username, miId, onClose, onAbrirPerfil }) {
  const [perfil, setPerfil] = useState(null);
  const [posts, setPosts] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [siguiendo, setSiguiendo] = useState(false);
  const [pendiente, setPendiente] = useState(false);
  const [lista, setLista] = useState(null); // { titulo, cargar } | null
  const [chat, setChat] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError("");
    (async () => {
      try {
        const { data } = await communityService.getPerfil(username);
        if (!vivo) return;
        setPerfil(data);
        setSiguiendo(!!data.loSigo);
        setPendiente(!!data.pendiente);
        const { data: dp } = await communityService.postsDeUsuario(data.id);
        if (vivo) setPosts(dp.posts || []);
      } catch (err) {
        if (vivo) setError(err?.response?.data?.error || "No se pudo cargar el perfil.");
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [username]);

  const toggleSeguir = async () => {
    if (!perfil) return;
    try {
      if (siguiendo || pendiente) {
        const eraSiguiendo = siguiendo;
        setSiguiendo(false);
        setPendiente(false);
        if (eraSiguiendo) {
          setPerfil((p) => ({ ...p, stats: { ...p.stats, seguidores: Math.max(0, p.stats.seguidores - 1) } }));
        }
        await communityService.dejarDeSeguir(perfil.id);
      } else {
        const { data } = await communityService.seguir(perfil.id);
        setSiguiendo(!!data.loSigo);
        setPendiente(!!data.pendiente);
        if (data.loSigo) {
          setPerfil((p) => ({ ...p, stats: { ...p.stats, seguidores: p.stats.seguidores + 1 } }));
        }
      }
    } catch {
      setSiguiendo(!!perfil.loSigo);
      setPendiente(!!perfil.pendiente);
    }
  };

  const labelSeguir = pendiente ? "Pendiente" : siguiendo ? "Siguiendo" : "Seguir";

  const ini = (perfil?.fullName || perfil?.username || "?").trim().charAt(0).toUpperCase();
  const esYo = perfil && String(perfil.id) === String(miId);

  return (
    <Modal titulo="Perfil" onClose={onClose} wide>
      {cargando ? (
        <div className={style.cargando}>Cargando…</div>
      ) : error ? (
        <div className={style.error} style={{ padding: "2rem" }}>{error}</div>
      ) : perfil ? (
        <div className={style.modalBody}>
          <div className={style.banner} style={perfil.banner ? { backgroundImage: `url(${perfil.banner})` } : undefined} />
          <div className={style.perfilTop}>
            <span className={style.perfilAvatar}>
              {perfil.foto ? <img src={perfil.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : ini}
            </span>
            <div className={style.perfilIdent}>
              <div className={style.perfilNombre}>{perfil.fullName || perfil.username}</div>
              <div className={style.perfilHandle}>@{perfil.username}</div>
            </div>
            {!esYo && (
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <button
                  className={style.btnMensaje}
                  onClick={() => setChat(true)}
                  aria-label="Mensaje"
                  title="Mensaje"
                >
                  <FiMessageCircle />
                </button>
                <button
                  className={`${style.btnSeguir} ${siguiendo || pendiente ? style.btnSiguiendo : ""}`}
                  onClick={toggleSeguir}
                >
                  {labelSeguir}
                </button>
              </div>
            )}
          </div>

          {perfil.bio ? <p className={style.perfilBio}>{perfil.bio}</p> : null}

          <div className={style.stats}>
            <div className={style.stat}>
              <div className={style.statNum}>{perfil.stats?.posteos ?? 0}</div>
              <div className={style.statLabel}>posteos</div>
            </div>
            <button
              type="button"
              className={`${style.stat} ${style.statBtn}`}
              onClick={() => setLista({ titulo: "Seguidores", cargar: () => communityService.seguidores(perfil.id) })}
            >
              <div className={style.statNum}>{perfil.stats?.seguidores ?? 0}</div>
              <div className={style.statLabel}>seguidores</div>
            </button>
            <button
              type="button"
              className={`${style.stat} ${style.statBtn}`}
              onClick={() => setLista({ titulo: "Siguiendo", cargar: () => communityService.siguiendo(perfil.id) })}
            >
              <div className={style.statNum}>{perfil.stats?.siguiendo ?? 0}</div>
              <div className={style.statLabel}>siguiendo</div>
            </button>
          </div>

          <div className={style.lista}>
            {!esYo && !perfil.puedeVer ? (
              <div className={style.vacio}>
                🔒 Perfil privado. {pendiente ? "Tu solicitud está pendiente de aprobación." : "Mandá una solicitud para ver sus posteos."}
              </div>
            ) : posts.length === 0 ? (
              <div className={style.vacio}>Todavía no hay posteos.</div>
            ) : (
              posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  miId={miId}
                  onAbrirPerfil={onAbrirPerfil}
                  onBorrar={
                    esYo
                      ? async (id) => {
                          setPosts((xs) => xs.filter((x) => x.id !== id));
                          try {
                            await communityService.borrarPost(id);
                          } catch {
                            /* no-op */
                          }
                        }
                      : undefined
                  }
                />
              ))
            )}
          </div>
        </div>
      ) : null}

      {lista && (
        <ListaUsuariosModal
          titulo={lista.titulo}
          cargar={lista.cargar}
          miId={miId}
          onCambio={() =>
            communityService
              .getPerfil(username)
              .then(({ data }) => setPerfil(data))
              .catch(() => {})
          }
          onClose={() => setLista(null)}
          onAbrirPerfil={onAbrirPerfil}
        />
      )}
      {chat && perfil && (
        <ChatModal
          modo="dm"
          id={perfil.id}
          titulo={perfil.fullName || perfil.username}
          miId={miId}
          onClose={() => setChat(false)}
        />
      )}
    </Modal>
  );
}
