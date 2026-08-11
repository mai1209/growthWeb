// Wrapper de modal para toda la sección comunidad: overlay + panel + cabecera
// con título y botón de cerrar. Cierra al tocar el fondo o Escape.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import style from "../../style/Comunidad.module.css";

export default function Modal({ titulo, onClose, children, headExtra }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return createPortal(
    <div className={style.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={style.modal}>
        <div className={style.modalHead}>
          <span className={style.modalTitulo}>{titulo}</span>
          {headExtra}
          <button className={style.modalX} onClick={onClose} aria-label="Cerrar">
            <FiX />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
