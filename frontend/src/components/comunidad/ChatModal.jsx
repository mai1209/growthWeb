// Chat (DM privado o chat de club). Mensajes + input, con polling cada 3s.
// Props: { modo: "dm" | "grupo", id, titulo, miId, onClose }
import { useCallback, useEffect, useRef, useState } from "react";
import { FiSend } from "react-icons/fi";
import { communityService } from "../../api";
import style from "../../style/Comunidad.module.css";
import Modal from "./Modal";
import { haceCuanto } from "./ui";

export default function ChatModal({ modo, id, titulo, miId, onClose }) {
  const [mensajes, setMensajes] = useState(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const scrollRef = useRef(null);

  const cargar = useCallback(() => {
    const req = modo === "grupo" ? communityService.getChatGrupo(id) : communityService.getDM(id);
    req.then(({ data }) => setMensajes(data.mensajes || [])).catch(() => setMensajes([]));
  }, [modo, id]);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 3000); // polling
    return () => clearInterval(t);
  }, [cargar]);

  // Autoscroll al final cuando llegan mensajes.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mensajes]);

  const enviar = async (e) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setTexto("");
    try {
      const { data } =
        modo === "grupo"
          ? await communityService.enviarChatGrupo(id, t)
          : await communityService.enviarDM(id, t);
      setMensajes((xs) => [...(xs || []), data.mensaje]);
    } catch {
      setTexto(t);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal titulo={titulo} onClose={onClose}>
      <div className={style.chatWrap}>
        <div className={style.chatMsgs} ref={scrollRef}>
          {mensajes === null ? (
            <div className={style.cargando}>Cargando…</div>
          ) : mensajes.length === 0 ? (
            <div className={style.vacio}>Todavía no hay mensajes. Escribí el primero 👋</div>
          ) : (
            mensajes.map((m) => {
              const mio = m.autor && String(m.autor.id) === String(miId);
              return (
                <div key={m.id} className={`${style.chatMsg} ${mio ? style.chatMio : ""}`}>
                  {!mio && modo === "grupo" ? (
                    <div className={style.chatAutor}>{m.autor?.fullName || m.autor?.username}</div>
                  ) : null}
                  <div className={style.chatBurbuja}>{m.texto}</div>
                  <div className={style.chatHora}>{haceCuanto(m.createdAt)}</div>
                </div>
              );
            })
          )}
        </div>
        <form
          className={style.chatForm}
          onSubmit={enviar}
          style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.5rem", width: "100%", boxSizing: "border-box" }}
        >
          <input
            className={style.chatInput}
            style={{ flex: "1 1 0", minWidth: 0 }}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribí un mensaje…"
            maxLength={2000}
            autoFocus
          />
          <button
            className={style.chatEnviar}
            style={{ flex: "0 0 42px" }}
            type="submit"
            disabled={!texto.trim() || enviando}
            aria-label="Enviar"
          >
            <FiSend />
          </button>
        </form>
      </div>
    </Modal>
  );
}
