// Popup con una lista de usuarios (seguidores / siguiendo / etc.).
// `cargar` es una función que devuelve la promesa del request ({ data: { usuarios } }).
import { useEffect, useState } from "react";
import style from "../../style/Comunidad.module.css";
import Modal from "./Modal";
import { UserRow } from "./ui";

export default function ListaUsuariosModal({ titulo, cargar, miId, onClose, onAbrirPerfil, onCambio }) {
  const [usuarios, setUsuarios] = useState(null);

  useEffect(() => {
    let vivo = true;
    cargar()
      .then(({ data }) => vivo && setUsuarios(data.usuarios || []))
      .catch(() => vivo && setUsuarios([]));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal titulo={titulo} onClose={onClose}>
      <div className={style.modalBody}>
        {usuarios === null ? (
          <div className={style.cargando}>Cargando…</div>
        ) : usuarios.length === 0 ? (
          <div className={style.vacio}>Todavía no hay nadie acá.</div>
        ) : (
          usuarios.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              miId={miId}
              onCambio={onCambio}
              onAbrirPerfil={(x) => {
                onClose?.();
                onAbrirPerfil?.(x);
              }}
            />
          ))
        )}
      </div>
    </Modal>
  );
}
