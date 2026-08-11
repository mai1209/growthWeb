// Crear o editar un club. Si recibe `grupo`, edita; si no, crea.
import { useRef, useState } from "react";
import { FiImage } from "react-icons/fi";
import { gruposService } from "../../api";
import style from "../../style/Comunidad.module.css";
import { redimensionarImagen } from "../../utils/imagenComunidad";
import Modal from "./Modal";

const DEPORTES = [
  { key: "mixto", label: "Mixto" },
  { key: "caminata", label: "Caminata" },
  { key: "carrera", label: "Carrera" },
  { key: "bici", label: "Bici" },
];

export default function CrearClubModal({ grupo, onClose, onGuardado }) {
  const editar = !!grupo;
  const [nombre, setNombre] = useState(grupo?.nombre || "");
  const [descripcion, setDescripcion] = useState(grupo?.descripcion || "");
  const [deporte, setDeporte] = useState(grupo?.deporte || "mixto");
  const [zona, setZona] = useState(grupo?.zona || "");
  const [foto, setFoto] = useState(grupo?.foto || "");
  const [guardando, setGuardando] = useState(false);
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

  const guardar = async () => {
    if (!nombre.trim()) {
      setError("Poné un nombre.");
      return;
    }
    setError("");
    setGuardando(true);
    try {
      const payload = { nombre: nombre.trim(), descripcion: descripcion.trim(), deporte, zona: zona.trim(), foto };
      const { data } = editar ? await gruposService.editar(grupo.id, payload) : await gruposService.crear(payload);
      onGuardado?.(data.grupo);
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.error || "No se pudo guardar.");
      setGuardando(false);
    }
  };

  return (
    <Modal titulo={editar ? "Editar club" : "Crear un club"} onClose={onClose}>
      <div className={style.modalBody}>
        {foto ? (
          <img src={foto} alt="" className={style.fotoPreview} onClick={() => fileRef.current?.click()} style={{ cursor: "pointer" }} />
        ) : (
          <div className={style.fotoPicker} onClick={() => fileRef.current?.click()}>
            <FiImage size={22} />
            <span>Foto del club (opcional)</span>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={elegirFoto} />

        <div className={style.formGroup}>
          <label className={style.label}>Nombre</label>
          <input className={style.input} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} placeholder="Runners del parque" />
        </div>

        <div className={style.formGroup}>
          <label className={style.label}>Deporte</label>
          <div className={style.chips}>
            {DEPORTES.map((d) => (
              <button key={d.key} className={`${style.chip} ${deporte === d.key ? style.chipOn : ""}`} onClick={() => setDeporte(d.key)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className={style.formGroup}>
          <label className={style.label}>Zona <span className={style.labelOpc}>(opcional)</span></label>
          <input className={style.input} value={zona} onChange={(e) => setZona(e.target.value)} maxLength={80} placeholder="Palermo, CABA" />
        </div>

        <div className={style.formGroup}>
          <label className={style.label}>Descripción <span className={style.labelOpc}>(opcional)</span></label>
          <textarea className={style.textarea} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={400} placeholder="¿De qué se trata el club?" />
        </div>

        {error && <div className={style.error}>{error}</div>}
        <button className={style.btnPrim} onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : editar ? "Guardar cambios" : "Crear club"}
        </button>
      </div>
    </Modal>
  );
}
