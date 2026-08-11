// Perfil público de un usuario: portada + stats + seguir/dejar de seguir + sus
// posteos. Mismo formato para uno mismo y para otros.
import { useEffect, useState } from "react";
import { communityService } from "../../api";
import style from "../../style/Comunidad.module.css";
import Modal from "./Modal";
import PostCard from "./PostCard";

export default function PerfilModal({ username, miId, onClose, onAbrirPerfil }) {
  const [perfil, setPerfil] = useState(null);
  const [posts, setPosts] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [siguiendo, setSiguiendo] = useState(false);

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
    const antes = siguiendo;
    setSiguiendo(!antes);
    setPerfil((p) => ({
      ...p,
      stats: { ...p.stats, seguidores: p.stats.seguidores + (antes ? -1 : 1) },
    }));
    try {
      if (antes) await communityService.dejarDeSeguir(perfil.id);
      else await communityService.seguir(perfil.id);
    } catch {
      setSiguiendo(antes);
      setPerfil((p) => ({
        ...p,
        stats: { ...p.stats, seguidores: p.stats.seguidores + (antes ? 1 : -1) },
      }));
    }
  };

  const ini = (perfil?.fullName || perfil?.username || "?").trim().charAt(0).toUpperCase();
  const esYo = perfil && String(perfil.id) === String(miId);

  return (
    <Modal titulo="Perfil" onClose={onClose}>
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
              <button
                className={`${style.btnSeguir} ${siguiendo ? style.btnSiguiendo : ""}`}
                onClick={toggleSeguir}
              >
                {siguiendo ? "Siguiendo" : "Seguir"}
              </button>
            )}
          </div>

          {perfil.bio ? <p className={style.perfilBio}>{perfil.bio}</p> : null}

          <div className={style.stats}>
            <div className={style.stat}>
              <div className={style.statNum}>{perfil.stats?.posteos ?? 0}</div>
              <div className={style.statLabel}>posteos</div>
            </div>
            <div className={style.stat}>
              <div className={style.statNum}>{perfil.stats?.seguidores ?? 0}</div>
              <div className={style.statLabel}>seguidores</div>
            </div>
            <div className={style.stat}>
              <div className={style.statNum}>{perfil.stats?.siguiendo ?? 0}</div>
              <div className={style.statLabel}>siguiendo</div>
            </div>
          </div>

          <div className={style.lista}>
            {posts.length === 0 ? (
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
    </Modal>
  );
}
