// Crear o editar un reto. La meta se ingresa en km y se guarda en metros.
import { useRef, useState } from "react";
import { FiImage, FiInfo } from "react-icons/fi";
import { retosService } from "../../api";
import style from "../../style/Comunidad.module.css";
import { redimensionarImagen } from "../../utils/imagenComunidad";
import Modal from "./Modal";

const DEPORTES = [
  { key: "mixto", label: "Mixto" },
  { key: "caminata", label: "Caminata" },
  { key: "carrera", label: "Carrera" },
  { key: "bici", label: "Bici" },
];

const hoyISO = () => new Date().toISOString().slice(0, 10);

export default function CrearRetoModal({ reto, onClose, onGuardado }) {
  const editar = !!reto;
  const [nombre, setNombre] = useState(reto?.nombre || "");
  const [descripcion, setDescripcion] = useState(reto?.descripcion || "");
  const [deporte, setDeporte] = useState(reto?.deporte || "mixto");
  const [metaKm, setMetaKm] = useState(reto ? String((reto.meta || 0) / 1000) : "");
  const [inicio, setInicio] = useState(reto?.inicio || hoyISO());
  const [fin, setFin] = useState(reto?.fin || "");
  const [foto, setFoto] = useState(reto?.foto || "");
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
    if (!nombre.trim()) return setError("Poné un nombre.");
    const metros = Math.round(parseFloat(String(metaKm).replace(",", ".")) * 1000);
    if (!metros || metros <= 0) return setError("Poné una meta en km válida.");
    if (!editar && (!inicio || !fin || fin < inicio)) return setError("Revisá las fechas.");
    setError("");
    setGuardando(true);
    try {
      const payload = editar
        ? { nombre: nombre.trim(), descripcion: descripcion.trim(), deporte, foto }
        : { nombre: nombre.trim(), descripcion: descripcion.trim(), deporte, meta: metros, inicio, fin, foto };
      const { data } = editar ? await retosService.editar(reto.id, payload) : await retosService.crear(payload);
      onGuardado?.(data.reto);
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.error || "No se pudo guardar.");
      setGuardando(false);
    }
  };

  return (
    <Modal titulo={editar ? "Editar reto" : "Crear un reto"} onClose={onClose}>
      <div className={style.modalBody}>
        {foto ? (
          <img src={foto} alt="" className={style.fotoPreview} onClick={() => fileRef.current?.click()} style={{ cursor: "pointer" }} />
        ) : (
          <div className={style.fotoPicker} onClick={() => fileRef.current?.click()}>
            <FiImage size={22} />
            <span>Foto del reto (opcional)</span>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={elegirFoto} />

        <div className={style.formGroup}>
          <label className={style.label}>Nombre</label>
          <input className={style.input} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} placeholder="100 km en octubre" />
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
          <label className={style.label}>Meta (km)</label>
          <input
            className={style.input}
            value={metaKm}
            onChange={(e) => setMetaKm(e.target.value)}
            inputMode="decimal"
            placeholder="100"
            disabled={editar}
          />
          {editar && <span className={style.labelOpc}>La meta y las fechas no se pueden cambiar.</span>}
        </div>

        {!editar && (
          <div className={style.row2}>
            <div className={style.formGroup}>
              <label className={style.label}>Desde</label>
              <input className={style.input} type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div className={style.formGroup}>
              <label className={style.label}>Hasta</label>
              <input className={style.input} type="date" value={fin} onChange={(e) => setFin(e.target.value)} min={inicio} />
            </div>
          </div>
        )}

        <div className={style.formGroup}>
          <label className={style.label}>Descripción <span className={style.labelOpc}>(opcional)</span></label>
          <textarea className={style.textarea} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={400} placeholder="¿En qué consiste el reto?" />
        </div>

        <div className={style.infoCard}>
          <div className={style.infoTitulo}><FiInfo /> ¿Cómo se suma?</div>
          Cada caminata, carrera o salida en bici que registres en Movilidad suma sus kilómetros al reto (según el deporte elegido) mientras esté dentro de las fechas.
        </div>

        {error && <div className={style.error}>{error}</div>}
        <button className={style.btnPrim} onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando…" : editar ? "Guardar cambios" : "Crear reto"}
        </button>
      </div>
    </Modal>
  );
}
