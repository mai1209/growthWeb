// Compositor para compartir un recorrido como imagen (web). Estilo igual a la
// app: bloque con DISTANCIA / RITMO / TIEMPO + recorrido chico + GROWTH, TODO
// junto y arrastrable sobre la foto. Exporta a PNG (descargar) o publica.
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiX, FiImage, FiDownload, FiSend } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { communityService } from "../api";
import { redimensionarImagen } from "../utils/imagenComunidad";

const ACT = { caminata: "Caminata", carrera: "Carrera", bici: "Bici" };

const fmtTiempo = (secs) => {
  const s = Math.max(0, Math.round(secs || 0));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}min ${String(ss).padStart(2, "0")}s`;
};
const fmtRitmo = (ritmo) => {
  if (!(ritmo > 0)) return "— /km";
  const m = Math.floor(ritmo);
  const s = Math.round((ritmo - m) * 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
};

// Proyecta la ruta GPS a coordenadas normalizadas [0..1] preservando el aspecto
// dentro de una caja pequeña (para dibujarla chica dentro del bloque de datos).
function proyectarRuta(ruta, boxW, boxH, pad = 6) {
  if (!Array.isArray(ruta) || ruta.length < 2) return null;
  const lats = ruta.map((p) => p.latitude);
  const lngs = ruta.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180) || 1;
  const spanLng = (maxLng - minLng) * kx || 1e-6;
  const spanLat = maxLat - minLat || 1e-6;
  const scale = Math.min((boxW - 2 * pad) / spanLng, (boxH - 2 * pad) / spanLat);
  const offX = (boxW - spanLng * scale) / 2;
  const offY = (boxH - spanLat * scale) / 2;
  return ruta.map((p) => ({
    x: offX + (p.longitude - minLng) * kx * scale,
    y: boxH - offY - (p.latitude - minLat) * scale,
  }));
}

const LIENZO_W = 360;
const LIENZO_H = 540; // 2:3
const EXPORT_W = 1080;
const EXPORT_H = 1620;
const ESCALA = EXPORT_W / LIENZO_W; // preview → export

// Caja del recorrido (en px de preview)
const RUTA_W = 150;
const RUTA_H = 90;

export default function CompartirRecorridoModal({ recorrido, onClose, onPublicado }) {
  const [foto, setFoto] = useState("");
  const [pos, setPos] = useState({ fx: 0.06, fy: 0.34 }); // esquina sup-izq del bloque
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);
  // Como Strava: layouts predefinidos que rotan al TOCAR el bloque, y una
  // escala para achicar/agrandar todo junto.
  const [layout, setLayout] = useState("vertical"); // vertical | horizontal | mini
  const [escala, setEscala] = useState(1);
  const navigate = useNavigate();
  const lienzoRef = useRef(null);
  const fileRef = useRef(null);
  const drag = useRef(null);

  const km = (recorrido?.metros || 0) / 1000;
  const secs = recorrido?.secs || 0;
  const ritmo = km > 0.02 && secs > 0 ? secs / 60 / km : 0; // min/km
  const rutaPts = useMemo(() => proyectarRuta(recorrido?.ruta, RUTA_W, RUTA_H), [recorrido]);

  const elegirFoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setFoto(await redimensionarImagen(file, 1600, 0.85));
    } catch {
      setError("No se pudo procesar la imagen.");
    }
  };

  // ---- Arrastre del bloque completo (datos + recorrido + GROWTH) ----
  const onPointerDown = (e) => {
    e.preventDefault();
    drag.current = { startX: e.clientX, startY: e.clientY, base: { ...pos }, moved: false };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };
  const onPointerMove = (e) => {
    if (!drag.current || !lienzoRef.current) return;
    if (
      Math.abs(e.clientX - drag.current.startX) > 6 ||
      Math.abs(e.clientY - drag.current.startY) > 6
    ) {
      drag.current.moved = true;
    }
    const rect = lienzoRef.current.getBoundingClientRect();
    const dx = (e.clientX - drag.current.startX) / rect.width;
    const dy = (e.clientY - drag.current.startY) / rect.height;
    setPos({
      fx: Math.min(0.9, Math.max(0.02, drag.current.base.fx + dx)),
      fy: Math.min(0.9, Math.max(0.02, drag.current.base.fy + dy)),
    });
  };
  const onPointerUp = () => {
    // Toque (sin arrastre) = rotar entre los layouts, como Strava.
    if (drag.current && !drag.current.moved) {
      setLayout((l) => (l === "vertical" ? "horizontal" : l === "horizontal" ? "mini" : "vertical"));
    }
    drag.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };

  const cargarImg = (src) =>
    new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });

  // ---- Exporta el lienzo a un dataURI JPEG ----
  const exportar = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_W;
    canvas.height = EXPORT_H;
    const ctx = canvas.getContext("2d");

    // Fondo: foto (cover) o degradado oscuro
    const img = await cargarImg(foto);
    if (img) {
      const ir = img.width / img.height;
      const cr = EXPORT_W / EXPORT_H;
      let sw, sh, sx, sy;
      if (ir > cr) {
        sh = img.height;
        sw = sh * cr;
        sx = (img.width - sw) / 2;
        sy = 0;
      } else {
        sw = img.width;
        sh = sw / cr;
        sx = 0;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, EXPORT_W, EXPORT_H);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, EXPORT_H);
      g.addColorStop(0, "#0e3540");
      g.addColorStop(1, "#050f15");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, EXPORT_W, EXPORT_H);
    }

    // Bloque (todo junto) tipo Strava: respeta el layout elegido (vertical /
    // horizontal / mini) y la escala. Anclado a la esquina sup-izq (como el DOM).
    const k = escala;
    let x = pos.fx * EXPORT_W;
    let y = pos.fy * EXPORT_H;
    ctx.textBaseline = "top";
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = 14 * k;

    const logo = await cargarImg("/logoDist.png");
    const logoSz = 26 * k;
    const logoW = logo ? logoSz * (logo.width / logo.height) : 0;

    const labelFont = `800 ${20 * k}px Arial, sans-serif`;
    const valueFont = `400 ${38 * k}px Arial, sans-serif`;
    const growthFont = `700 ${22 * k}px Arial, sans-serif`;
    const filas = [
      ["Distancia", `${km.toFixed(2).replace(".", ",")} km`],
      ["Ritmo", fmtRitmo(ritmo)],
      ["Tiempo", fmtTiempo(secs)],
    ];

    // Anchos por columna (para centrar y para la fila horizontal)
    const colW = filas.map(([l, v]) => {
      ctx.font = labelFont;
      const lw = ctx.measureText(l.toUpperCase()).width;
      ctx.font = valueFont;
      return Math.max(lw, ctx.measureText(v).width);
    });
    const gapFila = 40 * k;
    const rowW = colW.reduce((a, b) => a + b, 0) + gapFila * (filas.length - 1);
    const routeW = rutaPts ? RUTA_W * (ESCALA * 1.4 * k) : 0;
    ctx.font = growthFont;
    const growthTextW = ctx.measureText("GROWTH").width;
    const logoRowW = logoW + (logo ? 10 * k : 0) + growthTextW;

    let contentW = Math.max(routeW, logoRowW);
    if (layout === "vertical") contentW = Math.max(contentW, ...colW);
    if (layout === "horizontal") contentW = Math.max(contentW, rowW);
    const cx = x + contentW / 2;

    ctx.textAlign = "center";
    const dibujarStatsVertical = () => {
      filas.forEach(([label, value]) => {
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.font = labelFont;
        ctx.fillText(label.toUpperCase(), cx, y);
        y += 28 * k;
        ctx.fillStyle = "#ffffff";
        ctx.font = valueFont;
        ctx.fillText(value, cx, y);
        y += 62 * k;
      });
    };
    const dibujarStatsFila = () => {
      let colX = cx - rowW / 2;
      filas.forEach(([label, value], i) => {
        const c = colX + colW[i] / 2;
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.font = labelFont;
        ctx.fillText(label.toUpperCase(), c, y);
        ctx.fillStyle = "#ffffff";
        ctx.font = valueFont;
        ctx.fillText(value, c, y + 28 * k);
        colX += colW[i] + gapFila;
      });
      y += 28 * k + 52 * k;
    };
    const dibujarRuta = () => {
      if (!rutaPts) return;
      const s = ESCALA * 1.4 * k;
      const ox = cx - routeW / 2;
      const oy = y + 8 * k;
      const trazar = () => {
        ctx.beginPath();
        rutaPts.forEach((p, i) => {
          const px = ox + p.x * s;
          const py = oy + p.y * s;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
      };
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 14 * k;
      trazar();
      ctx.stroke();
      ctx.strokeStyle = "#3bcb23";
      ctx.lineWidth = 8 * k;
      trazar();
      ctx.stroke();
      y = oy + RUTA_H * s + 12 * k;
    };
    const dibujarLogo = () => {
      let gx = cx - logoRowW / 2;
      if (logo) {
        ctx.drawImage(logo, gx, y, logoW, logoSz);
        gx += logoW + 10 * k;
      }
      ctx.fillStyle = "#00ed64";
      ctx.font = growthFont;
      ctx.textAlign = "left";
      ctx.fillText("GROWTH", gx, y + (logoSz - 22 * k) / 2);
      ctx.textAlign = "center";
      y += logoSz + 10 * k;
    };

    // Orden clásico (igual que el preview): info → recorrido → logo abajo.
    if (layout === "horizontal") {
      dibujarStatsFila();
      dibujarRuta();
      dibujarLogo();
    } else if (layout === "vertical") {
      dibujarStatsVertical();
      dibujarRuta();
      dibujarLogo();
    } else {
      dibujarRuta();
      dibujarLogo();
    }
    ctx.textAlign = "start";
    ctx.shadowBlur = 0;

    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const descargar = async () => {
    setOcupado(true);
    setError("");
    try {
      const uri = await exportar();
      const a = document.createElement("a");
      a.href = uri;
      a.download = `recorrido-${recorrido?.fecha || "growth"}.jpg`;
      a.click();
    } catch {
      setError("No se pudo generar la imagen.");
    } finally {
      setOcupado(false);
    }
  };

  const publicar = async () => {
    setOcupado(true);
    setError("");
    try {
      const uri = await exportar();
      await communityService.crearPost({
        tipo: "actividad",
        texto: "",
        foto: uri,
        actividad: {
          tipo: recorrido?.tipo || "caminata",
          metros: recorrido?.metros || 0,
          secs,
          kcal: recorrido?.kcal || 0,
        },
      });
      // Mostramos el aviso de éxito y recién ahí cerramos todo (vuelve a movilidad).
      setExito(true);
      setTimeout(() => {
        onPublicado?.(); // refresca movilidad + cierra el visor de recorridos
        onClose?.(); // cierra este modal de compartir
        navigate("/perfil"); // renderiza el perfil
      }, 1500);
    } catch {
      setError("No se pudo publicar. Probá de nuevo.");
    } finally {
      setOcupado(false);
    }
  };

  return createPortal(
    <div style={S.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div style={S.modal}>
        <div style={S.head}>
          <span style={S.titulo}>Compartir imagen</span>
          <button style={S.iconBtn} onClick={onClose} aria-label="Cerrar">
            <FiX />
          </button>
        </div>

        {/* Lienzo (vista previa) */}
        <div
          ref={lienzoRef}
          style={{
            ...S.lienzo,
            background: foto
              ? `center/cover no-repeat url(${foto})`
              : "linear-gradient(180deg,#0e3540,#050f15)",
          }}
        >
          {foto ? <div style={S.oscurecer} /> : null}

          {/* Bloque arrastrable. Tocar (sin arrastrar) rota el layout, como Strava. */}
          <div
            style={{
              ...S.bloque,
              left: `${pos.fx * 100}%`,
              top: `${pos.fy * 100}%`,
              transform: `scale(${escala})`,
              transformOrigin: "top left",
            }}
            onPointerDown={onPointerDown}
          >
            {(() => {
              const statsEl =
                layout !== "mini" ? (
                  <div key="s" style={layout === "horizontal" ? S.statsFila : S.statsCol}>
                    <div style={S.stat}>
                      <div style={S.statLabel}>DISTANCIA</div>
                      <div style={S.statValor}>{km.toFixed(2).replace(".", ",")} km</div>
                    </div>
                    <div style={S.stat}>
                      <div style={S.statLabel}>RITMO</div>
                      <div style={S.statValor}>{fmtRitmo(ritmo)}</div>
                    </div>
                    <div style={S.stat}>
                      <div style={S.statLabel}>TIEMPO</div>
                      <div style={S.statValor}>{fmtTiempo(secs)}</div>
                    </div>
                  </div>
                ) : null;
              const rutaEl = rutaPts ? (
                <svg key="r" width={RUTA_W} height={RUTA_H} style={{ display: "block", margin: "6px 0" }}>
                  <polyline
                    points={rutaPts.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="rgba(0,0,0,0.5)"
                    strokeWidth="7"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <polyline
                    points={rutaPts.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="#3bcb23"
                    strokeWidth="4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              ) : null;
              const logoEl = (
                <div key="g" style={S.growthRow}>
                  <img src="/logoDist.png" alt="" style={S.growthLogo} draggable={false} />
                  <span style={S.growth}>GROWTH</span>
                </div>
              );
              // Orden clásico: info → recorrido → logo abajo (en mini, sin info).
              if (layout === "mini") return [rutaEl, logoEl];
              return [statsEl, rutaEl, logoEl];
            })()}
          </div>
        </div>

        {exito ? (
          <p
            style={{
              margin: "0.5rem 0 0",
              textAlign: "center",
              color: "#5dc72d",
              fontWeight: 800,
              fontSize: "0.98rem",
            }}
          >
            ✅ Esta foto fue cargada al perfil con éxito
          </p>
        ) : (
          <>
            <p style={S.tip}>
              Arrastrá los datos para moverlos · tocá el bloque para cambiar el formato · ajustá el
              tamaño abajo.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <span style={{ ...S.tip, margin: 0 }}>Tamaño</span>
              <input
                type="range"
                min="0.55"
                max="1.5"
                step="0.05"
                value={escala}
                onChange={(e) => setEscala(Number(e.target.value))}
                style={{ width: 160, accentColor: "#3bcb23" }}
              />
            </div>
            {error ? <p style={S.error}>{error}</p> : null}
          </>
        )}

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={elegirFoto} />
        <div style={S.acciones}>
          <button style={S.btnSec} onClick={() => fileRef.current?.click()} disabled={ocupado || exito}>
            <FiImage /> {foto ? "Cambiar foto" : "Subir foto"}
          </button>
          <button style={S.btnSec} onClick={descargar} disabled={ocupado || exito}>
            <FiDownload /> Descargar
          </button>
          <button style={S.btnPrim} onClick={publicar} disabled={ocupado || exito}>
            <FiSend /> {ocupado ? "…" : "Publicar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const S = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3000,
    padding: "1rem",
  },
  modal: {
    background: "var(--surface-card-strong, #0b232b)",
    border: "1px solid var(--border-color)",
    borderRadius: 18,
    width: "100%",
    maxWidth: 420,
    maxHeight: "94vh",
    overflowY: "auto",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.8rem",
  },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  titulo: { fontWeight: 800, fontSize: "1.05rem", color: "var(--color-text)" },
  iconBtn: {
    border: "none",
    background: "var(--surface-hover)",
    color: "var(--color-text)",
    width: 32,
    height: 32,
    borderRadius: "50%",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  lienzo: {
    position: "relative",
    width: "100%",
    maxWidth: LIENZO_W,
    aspectRatio: `${LIENZO_W} / ${LIENZO_H}`,
    margin: "0 auto",
    borderRadius: 14,
    overflow: "hidden",
    userSelect: "none",
    touchAction: "none",
  },
  oscurecer: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.28)" },
  bloque: {
    position: "absolute",
    cursor: "grab",
    color: "#fff",
    textShadow: "0 1px 8px rgba(0,0,0,0.65)",
    padding: 4,
    maxWidth: "80%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  statsCol: { display: "flex", flexDirection: "column", alignItems: "center" },
  statsFila: { display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 18 },
  stat: { marginBottom: 9, textAlign: "center" },
  statLabel: { fontSize: "0.52rem", fontWeight: 800, letterSpacing: "0.1em", opacity: 0.8 },
  statValor: { fontSize: "0.92rem", fontWeight: 400, lineHeight: 1.15, whiteSpace: "nowrap" },
  growthRow: { display: "flex", alignItems: "center", gap: 5, marginTop: 4 },
  growthLogo: { height: 16, width: "auto", display: "block", flexShrink: 0 },
  growth: { color: "#00ed64", fontWeight: 700, fontSize: "0.62rem", letterSpacing: "0.06em" },
  tip: { color: "var(--color-muted)", fontSize: "0.78rem", textAlign: "center", margin: 0 },
  error: { color: "var(--color-rojo)", fontSize: "0.82rem", textAlign: "center", margin: 0 },
  acciones: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
  btnSec: {
    flex: "1 1 auto",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.4rem",
    border: "1px solid var(--border-color)",
    background: "transparent",
    color: "var(--color-text)",
    fontWeight: 700,
    fontSize: "0.85rem",
    padding: "0.6rem",
    borderRadius: 12,
    cursor: "pointer",
  },
  btnPrim: {
    flex: "1 1 auto",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.4rem",
    border: "none",
    background: "var(--color-verde, #00ed64)",
    color: "var(--accent-contrast, #04140b)",
    fontWeight: 800,
    fontSize: "0.85rem",
    padding: "0.6rem",
    borderRadius: 12,
    cursor: "pointer",
  },
};
