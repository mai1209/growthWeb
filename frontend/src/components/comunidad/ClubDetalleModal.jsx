// Detalle de un club: portada, unirse/salir, miembros (con seguir), posteos del
// club y composer para miembros. El owner tiene menú de ajustes (editar/borrar).
import { useEffect, useState } from "react";
import { FiSettings, FiUsers, FiPlusCircle, FiEdit2, FiTrash2, FiLogOut, FiMapPin, FiArrowLeft, FiMessageCircle } from "react-icons/fi";
import { gruposService, communityService } from "../../api";
import style from "../../style/Comunidad.module.css";
import PostCard from "./PostCard";
import ComposePostModal from "./ComposePostModal";
import CrearClubModal from "./CrearClubModal";
import Modal from "./Modal";
import ChatModal from "./ChatModal";
import { UserRow } from "./ui";

const DEP_LABEL = { mixto: "Mixto", caminata: "Caminata", carrera: "Carrera", bici: "Bici" };

export default function ClubDetalleModal({ grupoId, grupoInicial, miId, yo, onClose, onAbrirPerfil, onCambio }) {
  const [grupo, setGrupo] = useState(grupoInicial || null);
  const [posts, setPosts] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [miembros, setMiembros] = useState(null);
  const [verMiembros, setVerMiembros] = useState(false);
  const [menu, setMenu] = useState(false);
  const [componer, setComponer] = useState(false);
  const [editar, setEditar] = useState(false);
  const [chat, setChat] = useState(false);

  const cargar = async () => {
    try {
      const [{ data: dg }, { data: dp }] = await Promise.all([
        gruposService.get(grupoId),
        communityService.postsDeGrupo(grupoId),
      ]);
      setGrupo(dg.grupo);
      setPosts(dp.posts || []);
    } catch {
      /* no-op */
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId]);

  const cargarMiembros = async () => {
    setVerMiembros(true);
    if (miembros === null) {
      try {
        const { data } = await gruposService.miembros(grupoId);
        setMiembros(data.miembros || []);
      } catch {
        setMiembros([]);
      }
    }
  };

  const unirse = async () => {
    setGrupo((g) => ({ ...g, soyMiembro: true, miembros: (g.miembros || 0) + 1 }));
    try {
      await gruposService.unirse(grupoId);
      onCambio?.();
    } catch {
      setGrupo((g) => ({ ...g, soyMiembro: false, miembros: Math.max(0, (g.miembros || 1) - 1) }));
    }
  };

  const salir = async () => {
    setMenu(false);
    setGrupo((g) => ({ ...g, soyMiembro: false, miembros: Math.max(0, (g.miembros || 1) - 1) }));
    try {
      await gruposService.salir(grupoId);
      onCambio?.();
    } catch {
      cargar();
    }
  };

  const borrar = async () => {
    if (!window.confirm("¿Borrar este club? No se puede deshacer.")) return;
    try {
      await gruposService.borrar(grupoId);
      onCambio?.();
      onClose?.();
    } catch {
      /* no-op */
    }
  };

  const publicar = async ({ texto, foto }) => {
    const { data } = await communityService.crearPost({ tipo: "texto", texto, foto, group: grupoId });
    setPosts((xs) => [data.post, ...xs]);
  };

  const ini = (grupo?.nombre || "?").trim().charAt(0).toUpperCase();

  const acciones = grupo?.soyOwner ? (
    <div style={{ position: "relative" }}>
      <button className={style.headerIconBtn} style={{ width: 34, height: 34 }} onClick={() => setMenu((m) => !m)} aria-label="Ajustes">
        <FiSettings />
      </button>
      {menu && (
        <div className={style.menuFlot} style={{ position: "absolute", right: 0, top: "2.4rem" }}>
          <button className={style.menuItem} onClick={() => { setMenu(false); setEditar(true); }}>
            <FiEdit2 /> Editar club
          </button>
          <button className={`${style.menuItem} ${style.menuItemPeligro}`} onClick={borrar}>
            <FiTrash2 /> Borrar club
          </button>
        </div>
      )}
    </div>
  ) : grupo?.soyMiembro ? (
    <button className={style.headerIconBtn} style={{ width: 34, height: 34 }} onClick={salir} aria-label="Salir del club" title="Salir del club">
      <FiLogOut />
    </button>
  ) : null;

  return (
    <div>
      <div className={style.detalleHead}>
        <button className={style.volverBtn} onClick={onClose} aria-label="Volver">
          <FiArrowLeft />
        </button>
        <span className={style.modalTitulo}>{grupo?.nombre || "Club"}</span>
        <div style={{ marginLeft: "auto" }}>{acciones}</div>
      </div>

      {cargando && !grupo ? (
        <div className={style.cargando}>Cargando…</div>
      ) : grupo ? (
        <div className={style.modalBody}>
          <div className={style.detalleFotoWrap}>
            <span className={style.detalleFoto}>
              {grupo.foto && /^(data:|https?:)/i.test(grupo.foto) ? <img src={grupo.foto} alt="" /> : ini}
            </span>
          </div>

          <div className={style.detalleCentro}>
            <div className={style.perfilNombre}>{grupo.nombre}</div>
            <div className={style.perfilHandle}>
              {DEP_LABEL[grupo.deporte] || "Mixto"}
              {grupo.zona ? <> · <FiMapPin style={{ verticalAlign: "-2px" }} /> {grupo.zona}</> : null}
              {" · "}{grupo.miembros} {grupo.miembros === 1 ? "miembro" : "miembros"}
            </div>
          </div>

          {grupo.descripcion ? <p className={`${style.descripcion} ${style.detalleCentro}`}>{grupo.descripcion}</p> : null}

          <div style={{ display: "flex", gap: "0.5rem" }}>
            {grupo.soyMiembro ? (
              <button className={style.subBtnPrim + " " + style.subBtn} onClick={() => setComponer(true)}>
                <FiPlusCircle /> Publicar
              </button>
            ) : (
              <button className={style.subBtnPrim + " " + style.subBtn} onClick={unirse}>
                Unirme al club
              </button>
            )}
            <button className={style.subBtn} onClick={cargarMiembros}>
              <FiUsers /> Miembros
            </button>
            {grupo.soyMiembro ? (
              <button className={style.subBtn} onClick={() => setChat(true)}>
                <FiMessageCircle /> Chat
              </button>
            ) : null}
          </div>

          {verMiembros && (
            <Modal titulo={`Miembros · ${grupo.miembros}`} onClose={() => setVerMiembros(false)}>
              <div className={style.modalBody}>
                {miembros === null ? (
                  <div className={style.cargando}>Cargando…</div>
                ) : miembros.length === 0 ? (
                  <div className={style.vacio}>Todavía no hay miembros.</div>
                ) : (
                  miembros.map((m) => (
                    <UserRow
                      key={m.id}
                      user={m}
                      miId={miId}
                      onAbrirPerfil={(u) => {
                        setVerMiembros(false);
                        onAbrirPerfil?.(u);
                      }}
                      extra={m.rol === "owner" ? <span className={style.itemBadge}>owner</span> : null}
                    />
                  ))
                )}
              </div>
            </Modal>
          )}

          <div className={style.lista}>
            {posts.length === 0 ? (
              <div className={style.vacio}>Todavía no hay posteos en el club.</div>
            ) : (
              posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  miId={miId}
                  onAbrirPerfil={onAbrirPerfil}
                  onBorrar={
                    p.autor && String(p.autor.id) === String(miId)
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
      ) : (
        <div className={style.error} style={{ padding: "2rem" }}>No se pudo cargar el club.</div>
      )}

      {componer && (
        <ComposePostModal
          user={yo}
          titulo="Publicar en el club"
          onClose={() => setComponer(false)}
          onPublicar={publicar}
        />
      )}
      {editar && (
        <CrearClubModal
          grupo={grupo}
          onClose={() => setEditar(false)}
          onGuardado={(g) => { setGrupo((prev) => ({ ...prev, ...g })); onCambio?.(); }}
        />
      )}
      {chat && grupo && (
        <ChatModal
          modo="grupo"
          id={grupoId}
          titulo={`Chat · ${grupo.nombre}`}
          miId={miId}
          onClose={() => setChat(false)}
        />
      )}
    </div>
  );
}
