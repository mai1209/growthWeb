// Composer de posteo compartido (feed y club). onPublicar({texto, foto})
// devuelve una promesa; el modal se cierra cuando resuelve.
import { useRef, useState } from "react";
import { FiImage, FiX } from "react-icons/fi";
import style from "../../style/Comunidad.module.css";
import { redimensionarImagen } from "../../utils/imagenComunidad";
import { Avatar } from "./ui";
import Modal from "./Modal";

const MAX = 600;

export default function ComposePostModal({ onClose, onPublicar, user, titulo = "Nuevo posteo" }) {
  const [texto, setTexto] = useState("");
  const [foto, setFoto] = useState("");
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const elegirFoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setFoto(await redimensionarImagen(file));
    } catch {
      setError("No se pudo procesar la imagen.");
    }
  };

  const publicar = async () => {
    if (publicando) return;
    if (!texto.trim() && !foto) {
      setError("Escribí algo o agregá una foto.");
      return;
    }
    setError("");
    setPublicando(true);
    try {
      await onPublicar({ texto: texto.trim(), foto });
      onClose?.();
    } catch {
      setError("No se pudo publicar. Probá de nuevo.");
      setPublicando(false);
    }
  };

  return (
    <Modal titulo={titulo} onClose={onClose}>
      <div className={style.modalBody}>
        {user && (
          <div className={style.postHead}>
            <Avatar user={user} />
            <div className={style.postAutor}>
              <span className={style.postNombre} style={{ cursor: "default" }}>
                {user.fullName || user.username}
              </span>
              <span className={style.postMeta}>@{user.username}</span>
            </div>
          </div>
        )}

        <textarea
          className={style.textarea}
          placeholder="¿Qué querés compartir?"
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, MAX))}
          autoFocus
          style={{ minHeight: 120 }}
        />

        {foto ? (
          <div style={{ position: "relative" }}>
            <img src={foto} alt="Vista previa" className={style.fotoPreview} />
            <button
              className={style.modalX}
              style={{ position: "absolute", top: 8, right: 8 }}
              onClick={() => setFoto("")}
              aria-label="Quitar foto"
            >
              <FiX />
            </button>
          </div>
        ) : (
          <div className={style.fotoPicker} onClick={() => fileRef.current?.click()}>
            <FiImage size={22} />
            <span>Agregar una foto</span>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={elegirFoto} />

        {error && <div className={style.error}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
          <span className={style.postMeta}>
            {texto.length}/{MAX}
          </span>
          <button className={style.btnPrim} style={{ width: "auto", padding: "0.7rem 1.4rem" }} onClick={publicar} disabled={publicando}>
            {publicando ? "Publicando…" : "Publicar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
