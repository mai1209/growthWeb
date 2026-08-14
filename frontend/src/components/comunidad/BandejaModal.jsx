// Bandeja de conversaciones (DMs): lista de chats privados con no leídos.
import { useCallback, useEffect, useState } from "react";
import { communityService } from "../../api";
import style from "../../style/Comunidad.module.css";
import Modal from "./Modal";
import ChatModal from "./ChatModal";
import { Avatar, haceCuanto } from "./ui";

export default function BandejaModal({ miId, onClose, onLeidas }) {
  const [convos, setConvos] = useState(null);
  const [chatUser, setChatUser] = useState(null);

  const cargar = useCallback(() => {
    communityService
      .conversaciones()
      .then(({ data }) => setConvos(data.conversaciones || []))
      .catch(() => setConvos([]));
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <Modal titulo="Mensajes" onClose={onClose}>
      <div className={style.modalBody}>
        {convos === null ? (
          <div className={style.cargando}>Cargando…</div>
        ) : convos.length === 0 ? (
          <div className={style.vacio}>Todavía no tenés conversaciones. Entrá a un perfil y tocá "Mensaje".</div>
        ) : (
          convos.map((c) => (
            <button key={c.usuario.id} className={style.convoRow} onClick={() => setChatUser(c.usuario)}>
              <Avatar user={c.usuario} className={style.avatarSm} />
              <div className={style.convoInfo}>
                <div className={style.convoNombre}>{c.usuario.fullName || c.usuario.username}</div>
                <div className={style.convoUltimo}>{c.ultimo}</div>
              </div>
              {c.noLeidos > 0 ? (
                <span className={style.convoBadge}>{c.noLeidos}</span>
              ) : (
                <span className={style.convoCuando}>{haceCuanto(c.cuando)}</span>
              )}
            </button>
          ))
        )}
      </div>
      {chatUser && (
        <ChatModal
          modo="dm"
          id={chatUser.id}
          titulo={chatUser.fullName || chatUser.username}
          miId={miId}
          onClose={() => {
            setChatUser(null);
            onLeidas?.();
            cargar();
          }}
        />
      )}
    </Modal>
  );
}
