// Piezas chicas compartidas por toda la sección comunidad.
import { useState } from "react";
import { communityService } from "../../api";
import style from "../../style/Comunidad.module.css";

// Avatar: foto si hay, si no las iniciales. `onClick` opcional (abrir perfil).
export function Avatar({ user, className = "", onClick }) {
  const foto = user?.foto || "";
  const nombre = user?.fullName || user?.username || "";
  const ini = nombre.trim().charAt(0).toUpperCase() || "?";
  const cls = `${style.avatar} ${className}`;
  const contenido = foto ? (
    <img src={foto} alt={nombre} className={cls} style={{ padding: 0 }} onClick={onClick} />
  ) : (
    <span className={cls} onClick={onClick}>{ini}</span>
  );
  if (!onClick) return contenido;
  return contenido;
}

// Tiempo relativo en español ("ahora", "hace 5 min", "hace 2 h", "hace 3 d").
export function haceCuanto(iso) {
  if (!iso) return "";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  const sem = Math.floor(d / 7);
  return sem < 5 ? `hace ${sem} sem` : `hace ${Math.floor(d / 30)} mes`;
}

// Fila de usuario con botón seguir. Se usa en miembros de club y ranking de
// reto. `extra` es contenido a la derecha (ej: metros del reto).
export function UserRow({ user, onAbrirPerfil, extra, pos, miId, onCambio }) {
  const [siguiendo, setSiguiendo] = useState(!!user.loSigo);
  const [pendiente, setPendiente] = useState(!!user.pendiente);
  const [ocupado, setOcupado] = useState(false);
  const esYo = user.esYo || (miId != null && String(user.id) === String(miId));

  const toggle = async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      if (siguiendo || pendiente) {
        // Ya lo sigo (o le mandé solicitud): dejar de seguir / cancelar.
        setSiguiendo(false);
        setPendiente(false);
        await communityService.dejarDeSeguir(user.id);
      } else {
        const { data } = await communityService.seguir(user.id);
        setSiguiendo(!!data.loSigo);
        setPendiente(!!data.pendiente); // cuenta privada → queda pendiente
      }
      onCambio?.();
    } catch {
      setSiguiendo(!!user.loSigo);
      setPendiente(!!user.pendiente);
    } finally {
      setOcupado(false);
    }
  };

  const label = pendiente ? "Pendiente" : siguiendo ? "Siguiendo" : "Seguir";

  return (
    <div className={style.userRow}>
      {pos != null && <span className={style.rankPos}>{pos}</span>}
      <Avatar user={user} className={style.avatarSm} onClick={() => onAbrirPerfil?.(user)} />
      <div className={style.userRowInfo}>
        <div className={style.userRowNombre}>{user.fullName || user.username}</div>
        <div className={style.userRowSub}>@{user.username}</div>
      </div>
      {extra}
      {!esYo && (
        <button className={`${style.btnSeguir} ${siguiendo || pendiente ? style.btnSiguiendo : ""}`} onClick={toggle} disabled={ocupado}>
          {label}
        </button>
      )}
    </div>
  );
}
