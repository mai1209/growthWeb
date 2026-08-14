// Popup de notificaciones: nuevos seguidores, solicitudes (aceptar/rechazar),
// kudos y comentarios. Al abrirlo se marcan como leídas.
import { useEffect, useState } from "react";
import { communityService } from "../../api";
import style from "../../style/Comunidad.module.css";
import Modal from "./Modal";
import { Avatar, haceCuanto } from "./ui";

const TEXTO = {
  follow: "empezó a seguirte",
  solicitud: "quiere seguirte",
  kudo: "le dio kudos a tu posteo",
  comentario: "comentó tu posteo",
};

export default function NotificacionesModal({ miId, onClose, onAbrirPerfil, onLeidas }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    let vivo = true;
    communityService
      .notificaciones()
      .then(({ data }) => {
        if (!vivo) return;
        setItems(data.notificaciones || []);
        // Marcar leídas al abrir (limpia el globito).
        communityService.marcarLeidas().then(() => onLeidas?.()).catch(() => {});
      })
      .catch(() => setItems([]));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const responder = async (n, aceptar) => {
    // Optimista: saco los botones y actualizo el texto.
    setItems((xs) =>
      xs.map((x) => (x.id === n.id ? { ...x, tipo: aceptar ? "follow" : "rechazada" } : x))
    );
    try {
      if (aceptar) await communityService.aceptarSolicitud(n.actor.id);
      else await communityService.rechazarSolicitud(n.actor.id);
    } catch {
      /* no-op */
    }
  };

  return (
    <Modal titulo="Notificaciones" onClose={onClose}>
      <div className={style.modalBody}>
        {items === null ? (
          <div className={style.cargando}>Cargando…</div>
        ) : items.length === 0 ? (
          <div className={style.vacio}>Todavía no tenés notificaciones.</div>
        ) : (
          items
            .filter((n) => n.tipo !== "rechazada")
            .map((n) => (
              <div key={n.id} className={style.notifRow}>
                <Avatar user={n.actor} className={style.avatarSm} onClick={() => { onClose?.(); onAbrirPerfil?.(n.actor); }} />
                <div className={style.notifTexto}>
                  <span className={style.notifNombre} onClick={() => { onClose?.(); onAbrirPerfil?.(n.actor); }}>
                    {n.actor?.fullName || n.actor?.username}
                  </span>{" "}
                  {TEXTO[n.tipo] || "interactuó con vos"}
                  <span className={style.notifCuando}> · {haceCuanto(n.createdAt)}</span>
                </div>
                {n.tipo === "solicitud" ? (
                  <div className={style.notifAcciones}>
                    <button className={style.notifAceptar} onClick={() => responder(n, true)}>
                      Aceptar
                    </button>
                    <button className={style.notifRechazar} onClick={() => responder(n, false)}>
                      Rechazar
                    </button>
                  </div>
                ) : null}
              </div>
            ))
        )}
      </div>
    </Modal>
  );
}
