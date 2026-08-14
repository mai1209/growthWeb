// Página de Comunidad (web). Cuatro pestañas: Inicio (feed), Buscar (usuarios),
// Clubes y Retos. Reusa los mismos endpoints que la app.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiHome,
  FiSearch,
  FiUsers,
  FiAward,
  FiPlusCircle,
  FiPlus,
  FiMapPin,
  FiCalendar,
  FiBell,
} from "react-icons/fi";
import { communityService, gruposService, retosService } from "../api";
import style from "../style/Comunidad.module.css";
import PostCard from "./comunidad/PostCard";
import ComposePostModal from "./comunidad/ComposePostModal";
import PerfilModal from "./comunidad/PerfilModal";
import NotificacionesModal from "./comunidad/NotificacionesModal";
import ClubDetalleModal from "./comunidad/ClubDetalleModal";
import RetoDetalleModal from "./comunidad/RetoDetalleModal";
import CrearClubModal from "./comunidad/CrearClubModal";
import CrearRetoModal from "./comunidad/CrearRetoModal";
import { Avatar, UserRow } from "./comunidad/ui";

const DEP_LABEL = { mixto: "Mixto", caminata: "Caminata", carrera: "Carrera", bici: "Bici" };
const km = (m) => (m / 1000).toFixed(1).replace(".", ",");
const fechaCorta = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

const TABS = [
  { key: "inicio", label: "Inicio", Icon: FiHome },
  { key: "buscar", label: "Buscar", Icon: FiSearch },
  { key: "clubes", label: "Clubes", Icon: FiUsers },
  { key: "retos", label: "Retos", Icon: FiAward },
];

export default function ComunidadPage() {
  const navigate = useNavigate();
  const [yo, setYo] = useState(null);
  const [tab, setTab] = useState("inicio");

  // Modales globales
  const [perfilUsername, setPerfilUsername] = useState(null);
  const [clubAbierto, setClubAbierto] = useState(null); // {id, inicial}
  const [retoAbierto, setRetoAbierto] = useState(null);
  const [componer, setComponer] = useState(false);
  const [crearClub, setCrearClub] = useState(false);
  const [crearReto, setCrearReto] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [noLeidas, setNoLeidas] = useState(0);

  useEffect(() => {
    communityService.getMiPerfil().then(({ data }) => setYo(data)).catch(() => {});
    communityService.notificaciones().then(({ data }) => setNoLeidas(data.noLeidas || 0)).catch(() => {});
  }, []);

  const abrirPerfil = useCallback(
    (user) => {
      if (!user) return;
      // Mi propio perfil abre el perfil principal (/perfil), no un modal.
      if (yo && String(user.id) === String(yo.id)) {
        navigate("/perfil");
        return;
      }
      if (user.username) setPerfilUsername(user.username);
    },
    [yo, navigate]
  );

  // Detalle inline: si hay un club o reto abierto, ocupa la pantalla (con su
  // botón de volver) en vez de abrirse como popup.
  if (clubAbierto) {
    return (
      <div className={style.wrap}>
        <ClubDetalleModal
          grupoId={clubAbierto.id}
          miId={yo?.id}
          yo={yo}
          onClose={() => setClubAbierto(null)}
          onAbrirPerfil={abrirPerfil}
          onCambio={() => {}}
        />
        {perfilUsername && (
          <PerfilModal
            username={perfilUsername}
            miId={yo?.id}
            onClose={() => setPerfilUsername(null)}
            onAbrirPerfil={abrirPerfil}
          />
        )}
      </div>
    );
  }
  if (retoAbierto) {
    return (
      <div className={style.wrap}>
        <RetoDetalleModal
          retoId={retoAbierto.id}
          miId={yo?.id}
          onClose={() => setRetoAbierto(null)}
          onAbrirPerfil={abrirPerfil}
          onCambio={() => {}}
        />
        {perfilUsername && (
          <PerfilModal
            username={perfilUsername}
            miId={yo?.id}
            onClose={() => setPerfilUsername(null)}
            onAbrirPerfil={abrirPerfil}
          />
        )}
      </div>
    );
  }

  return (
    <div className={style.wrap}>
      <div className={style.header}>
        <div>
          <p className={style.kicker}>Comunidad</p>
          <h1>Growth social</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            className={`${style.headerIconBtn} ${style.campanaWrap}`}
            onClick={() => setNotifsOpen(true)}
            aria-label="Notificaciones"
            title="Notificaciones"
          >
            <FiBell />
            {noLeidas > 0 && <span className={style.campanaBadge}>{noLeidas > 9 ? "9+" : noLeidas}</span>}
          </button>
          <button className={style.headerIconBtn} onClick={() => yo && abrirPerfil(yo)} aria-label="Mi perfil" title="Mi perfil">
            <Avatar user={yo} />
          </button>
        </div>
      </div>

      <div className={style.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`${style.tab} ${tab === t.key ? style.tabOn : ""}`}
            onClick={() => setTab(t.key)}
          >
            <t.Icon /> {t.label}
          </button>
        ))}
      </div>

      {tab === "inicio" && (
        <FeedTab yo={yo} onAbrirPerfil={abrirPerfil} onComponer={() => setComponer(true)} />
      )}
      {tab === "buscar" && <BuscarTab miId={yo?.id} onAbrirPerfil={abrirPerfil} />}
      {tab === "clubes" && (
        <ClubesTab
          onAbrir={(g) => setClubAbierto({ id: g.id })}
          onCrear={() => setCrearClub(true)}
        />
      )}
      {tab === "retos" && (
        <RetosTab
          onAbrir={(r) => setRetoAbierto({ id: r.id })}
          onCrear={() => setCrearReto(true)}
        />
      )}

      {/* ---------- Modales ---------- */}
      {perfilUsername && (
        <PerfilModal
          username={perfilUsername}
          miId={yo?.id}
          onClose={() => setPerfilUsername(null)}
          onAbrirPerfil={abrirPerfil}
        />
      )}
      {notifsOpen && (
        <NotificacionesModal
          miId={yo?.id}
          onClose={() => setNotifsOpen(false)}
          onAbrirPerfil={abrirPerfil}
          onLeidas={() => setNoLeidas(0)}
        />
      )}
      {componer && (
        <ComposePostModal
          user={yo}
          onClose={() => setComponer(false)}
          onPublicar={async ({ texto, foto }) => {
            await communityService.crearPost({ tipo: "texto", texto, foto });
          }}
        />
      )}
      {crearClub && (
        <CrearClubModal onClose={() => setCrearClub(false)} onGuardado={(g) => setClubAbierto({ id: g.id })} />
      )}
      {crearReto && (
        <CrearRetoModal onClose={() => setCrearReto(false)} onGuardado={(r) => setRetoAbierto({ id: r.id })} />
      )}
    </div>
  );
}

/* ================= FEED ================= */
function FeedTab({ yo, onAbrirPerfil, onComponer }) {
  const [posts, setPosts] = useState(null);

  const cargar = useCallback(() => {
    communityService.feed().then(({ data }) => setPosts(data.posts || [])).catch(() => setPosts([]));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const borrar = async (id) => {
    setPosts((xs) => (xs || []).filter((x) => x.id !== id));
    try { await communityService.borrarPost(id); } catch { /* no-op */ }
  };

  return (
    <>
      <button className={`${style.subBtn} ${style.subBtnPrim}`} onClick={onComponer}>
        <FiPlusCircle /> Compartir algo
      </button>
      {posts === null ? (
        <div className={style.cargando}>Cargando…</div>
      ) : posts.length === 0 ? (
        <div className={style.vacio}>Todavía no hay posteos. Seguí gente o compartí algo para empezar.</div>
      ) : (
        <div className={style.lista}>
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              miId={yo?.id}
              onAbrirPerfil={onAbrirPerfil}
              onBorrar={p.autor && String(p.autor.id) === String(yo?.id) ? borrar : undefined}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ================= BUSCAR ================= */
function BuscarTab({ miId, onAbrirPerfil }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const t = setTimeout(() => {
      communityService
        .buscar(term)
        .then(({ data }) => setResultados(data.usuarios || []))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <>
      <div className={style.buscador}>
        <FiSearch />
        <input placeholder="Buscar personas por nombre o @usuario" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      {q.trim().length < 2 ? (
        <div className={style.vacio}>Escribí al menos 2 letras para buscar.</div>
      ) : buscando ? (
        <div className={style.cargando}>Buscando…</div>
      ) : resultados.length === 0 ? (
        <div className={style.vacio}>No se encontró a nadie.</div>
      ) : (
        <div>
          {resultados.map((u) => (
            <UserRow key={u.id} user={u} miId={miId} onAbrirPerfil={onAbrirPerfil} />
          ))}
        </div>
      )}
    </>
  );
}

/* ================= CLUBES ================= */
function ClubesTab({ onAbrir, onCrear }) {
  const [modo, setModo] = useState("descubrir"); // descubrir | mios
  const [q, setQ] = useState("");
  const [lista, setLista] = useState(null);

  useEffect(() => {
    setLista(null);
    const cargar = () =>
      (modo === "mios" ? gruposService.mios() : gruposService.descubrir(q.trim()))
        .then(({ data }) => setLista(data.grupos || []))
        .catch(() => setLista([]));
    const t = setTimeout(cargar, modo === "descubrir" && q ? 300 : 0);
    return () => clearTimeout(t);
  }, [modo, q]);

  return (
    <>
      <div className={style.subtabs}>
        <button className={`${style.subBtn} ${modo === "descubrir" ? style.subBtnPrim : ""}`} onClick={() => setModo("descubrir")}>Descubrir</button>
        <button className={`${style.subBtn} ${modo === "mios" ? style.subBtnPrim : ""}`} onClick={() => setModo("mios")}>Mis clubes</button>
      </div>
      <button className={`${style.subBtn} ${style.subBtnPrim}`} onClick={onCrear}><FiPlus /> Crear un club</button>

      {modo === "descubrir" && (
        <div className={style.buscador}>
          <FiSearch />
          <input placeholder="Buscar clubes" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}

      {lista === null ? (
        <div className={style.cargando}>Cargando…</div>
      ) : lista.length === 0 ? (
        <div className={style.vacio}>{modo === "mios" ? "Todavía no estás en ningún club." : "No hay clubes para mostrar."}</div>
      ) : (
        <div className={style.lista}>
          {lista.map((g) => (
            <button key={g.id} className={style.itemCard} onClick={() => onAbrir(g)}>
              <span className={style.itemFoto}>
                {g.foto ? <img src={g.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (g.nombre || "?").charAt(0).toUpperCase()}
              </span>
              <div className={style.itemInfo}>
                <div className={style.itemNombre}>{g.nombre}</div>
                <div className={style.itemSub}>
                  {DEP_LABEL[g.deporte] || "Mixto"}
                  {g.zona ? <> · <FiMapPin style={{ verticalAlign: "-2px" }} /> {g.zona}</> : null}
                  {" · "}{g.miembros} {g.miembros === 1 ? "miembro" : "miembros"}
                </div>
              </div>
              {g.soyMiembro && <span className={style.itemBadge}>Miembro</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ================= RETOS ================= */
function RetosTab({ onAbrir, onCrear }) {
  const [modo, setModo] = useState("descubrir");
  const [q, setQ] = useState("");
  const [lista, setLista] = useState(null);

  useEffect(() => {
    setLista(null);
    const cargar = () =>
      (modo === "mios" ? retosService.mios() : retosService.descubrir(q.trim()))
        .then(({ data }) => setLista(data.retos || []))
        .catch(() => setLista([]));
    const t = setTimeout(cargar, modo === "descubrir" && q ? 300 : 0);
    return () => clearTimeout(t);
  }, [modo, q]);

  return (
    <>
      <div className={style.subtabs}>
        <button className={`${style.subBtn} ${modo === "descubrir" ? style.subBtnPrim : ""}`} onClick={() => setModo("descubrir")}>Descubrir</button>
        <button className={`${style.subBtn} ${modo === "mios" ? style.subBtnPrim : ""}`} onClick={() => setModo("mios")}>Mis retos</button>
      </div>
      <button className={`${style.subBtn} ${style.subBtnPrim}`} onClick={onCrear}><FiPlus /> Crear un reto</button>

      {modo === "descubrir" && (
        <div className={style.buscador}>
          <FiSearch />
          <input placeholder="Buscar retos" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}

      {lista === null ? (
        <div className={style.cargando}>Cargando…</div>
      ) : lista.length === 0 ? (
        <div className={style.vacio}>{modo === "mios" ? "Todavía no estás en ningún reto." : "No hay retos para mostrar."}</div>
      ) : (
        <div className={style.lista}>
          {lista.map((r) => {
            const pct = r.meta ? Math.min(100, Math.round(((r.miProgreso || 0) / r.meta) * 100)) : 0;
            return (
              <button key={r.id} className={style.itemCard} style={{ alignItems: "stretch" }} onClick={() => onAbrir(r)}>
                <span className={style.itemFoto}>
                  {r.foto ? <img src={r.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <FiAward />}
                </span>
                <div className={style.itemInfo}>
                  <div className={style.itemNombre}>{r.nombre}</div>
                  <div className={style.itemSub}>
                    {DEP_LABEL[r.deporte] || "Mixto"} · {km(r.meta)} km · <FiCalendar style={{ verticalAlign: "-2px" }} /> {fechaCorta(r.fin)}
                  </div>
                  {r.meApunto && (
                    <div className={style.progreso}>
                      <div className={style.progresoFill} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
                {r.meApunto ? <span className={style.itemBadge}>{pct}%</span> : <span className={style.itemBadge}>{r.participantes}👥</span>}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
