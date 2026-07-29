import { useEffect, useRef, useState } from "react";
import style from "../style/PhotoCropper.module.css";

// Ajustador de foto de perfil: arrastrás para mover y con la barra hacés zoom.
// Al guardar, recorta el círculo visible a un cuadrado y devuelve un data URL.
export default function PhotoCropper({ src, onCancel, onSave, viewport = 260, output = 512 }) {
  const [img, setImg] = useState(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragRef = useRef(null);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setScale(1);
      setTx(0);
      setTy(0);
    };
    image.src = src;
  }, [src]);

  const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

  // Tamaño mostrado: la imagen "cubre" el círculo al scale 1.
  const baseScale = img ? Math.max(viewport / img.width, viewport / img.height) : 1;
  const dw = img ? img.width * baseScale * scale : viewport;
  const dh = img ? img.height * baseScale * scale : viewport;

  const clampOffsets = (nx, ny, w = dw, h = dh) => {
    const maxX = Math.max(0, (w - viewport) / 2);
    const maxY = Math.max(0, (h - viewport) / 2);
    return [clamp(nx, -maxX, maxX), clamp(ny, -maxY, maxY)];
  };

  const onPointerDown = (e) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: tx, oy: ty };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const [nx, ny] = clampOffsets(dragRef.current.ox + dx, dragRef.current.oy + dy);
    setTx(nx);
    setTy(ny);
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleScale = (s) => {
    setScale(s);
    if (!img) return;
    const nw = img.width * baseScale * s;
    const nh = img.height * baseScale * s;
    const [nx, ny] = clampOffsets(tx, ty, nw, nh);
    setTx(nx);
    setTy(ny);
  };

  const save = () => {
    if (!img) return;
    const factor = baseScale * scale;
    const sWidth = viewport / factor;
    const sHeight = viewport / factor;
    const sx = (img.width - sWidth) / 2 - tx / factor;
    const sy = (img.height - sHeight) / 2 - ty / factor;
    const canvas = document.createElement("canvas");
    canvas.width = output;
    canvas.height = output;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, output, output);
    onSave(canvas.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div className={style.overlay} onClick={onCancel} role="presentation">
      <div className={style.card} onClick={(e) => e.stopPropagation()}>
        <h3 className={style.title}>Ajustá tu foto</h3>
        <p className={style.hint}>Arrastrá para mover · usá la barra para el zoom</p>

        <div
          className={style.viewport}
          style={{ width: viewport, height: viewport }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {img ? (
            <img
              src={src}
              alt=""
              draggable={false}
              className={style.img}
              style={{
                width: dw,
                height: dh,
                marginLeft: -dw / 2,
                marginTop: -dh / 2,
                transform: `translate(${tx}px, ${ty}px)`,
              }}
            />
          ) : null}
          <div className={style.ring} />
        </div>

        <input
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={scale}
          onChange={(e) => handleScale(Number(e.target.value))}
          className={style.zoom}
          aria-label="Zoom"
        />

        <div className={style.actions}>
          <button type="button" className={style.ghost} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={style.primary} onClick={save} disabled={!img}>
            Guardar foto
          </button>
        </div>
      </div>
    </div>
  );
}
