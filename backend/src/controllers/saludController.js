import Salud from "../models/saludModel.js";

const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

// Cuántos días guardamos por sección (con orden cronológico de clave alcanza).
const MAX_DIAS = { pasos: 400, pasosManual: 400, agua: 60, animo: 120, peso: 400, comidas: 60 };
const MAX_CAMINATAS = 100;
const MAX_COMIDAS_DIA = 40;

// Mergea una sección por-día: toma el objeto guardado y le pisa las claves que
// vienen en el body (el que escribe un día gana ese día), recortando al máximo.
const mergeDias = (actual, entrante, limpiarValor, max) => {
  const base = actual && typeof actual === "object" ? { ...actual } : {};
  Object.keys(entrante || {}).forEach((k) => {
    if (!esFecha(k)) return;
    base[k] = limpiarValor(entrante[k]);
  });
  const recortado = {};
  Object.keys(base)
    .sort()
    .slice(-max)
    .forEach((k) => {
      recortado[k] = base[k];
    });
  return recortado;
};

const limpiarComidasDia = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, MAX_COMIDAS_DIA).map((c) => ({
    id: String(c?.id || "").slice(0, 40),
    franja: String(c?.franja || "").slice(0, 20),
    nombre: String(c?.nombre || "").slice(0, 120),
    kcal: num(c?.kcal),
    carbG: num(c?.carbG),
    protG: num(c?.protG),
    fatG: num(c?.fatG),
  }));
};

const obtenerDoc = async (userId) => {
  const existente = await Salud.findOne({ usuario: userId });
  if (existente) return existente;
  return Salud.create({ usuario: userId });
};

const serializar = (doc) => ({
  pasos: doc.pasos || {},
  pasosManual: doc.pasosManual || {},
  agua: doc.agua || {},
  animo: doc.animo || {},
  peso: doc.peso || {},
  comidas: doc.comidas || {},
  caminatas: doc.caminatas || [],
  nutri: doc.nutri || null,
  metas: doc.metas || null,
  updatedAt: doc.updatedAt,
});

// GET /api/salud
export const getSalud = async (req, res) => {
  try {
    const doc = await obtenerDoc(req.userId);
    return res.json(serializar(doc));
  } catch (err) {
    console.error("[salud] get:", err.message);
    return res.status(500).json({ error: "No se pudo cargar salud." });
  }
};

// PUT /api/salud — el body trae solo las secciones que quiere actualizar.
export const updateSalud = async (req, res) => {
  try {
    const body = req.body || {};
    const doc = await obtenerDoc(req.userId);

    if (body.pasos && typeof body.pasos === "object") {
      doc.pasos = mergeDias(doc.pasos, body.pasos, num, MAX_DIAS.pasos);
      doc.markModified("pasos");
    }
    if (body.pasosManual && typeof body.pasosManual === "object") {
      doc.pasosManual = mergeDias(doc.pasosManual, body.pasosManual, num, MAX_DIAS.pasosManual);
      doc.markModified("pasosManual");
    }
    if (body.agua && typeof body.agua === "object") {
      doc.agua = mergeDias(doc.agua, body.agua, num, MAX_DIAS.agua);
      doc.markModified("agua");
    }
    if (body.animo && typeof body.animo === "object") {
      doc.animo = mergeDias(doc.animo, body.animo, (v) => Math.min(5, Math.max(1, num(v) || 1)), MAX_DIAS.animo);
      doc.markModified("animo");
    }
    if (body.peso && typeof body.peso === "object") {
      doc.peso = mergeDias(doc.peso, body.peso, num, MAX_DIAS.peso);
      doc.markModified("peso");
    }
    if (body.comidas && typeof body.comidas === "object") {
      doc.comidas = mergeDias(doc.comidas, body.comidas, limpiarComidasDia, MAX_DIAS.comidas);
      doc.markModified("comidas");
    }
    if (Array.isArray(body.caminatas)) {
      doc.caminatas = body.caminatas
        .filter((c) => c && esFecha(c.fecha))
        .slice(0, MAX_CAMINATAS)
        .map((c) => ({ fecha: c.fecha, metros: num(c.metros), secs: num(c.secs) }));
    }
    if (body.nutri && typeof body.nutri === "object") {
      doc.nutri = {
        peso: num(body.nutri.peso),
        altura: num(body.nutri.altura),
        edad: num(body.nutri.edad),
        sexo: body.nutri.sexo === "M" ? "M" : "H",
        actividad: String(body.nutri.actividad || "ligero").slice(0, 20),
        objetivo: String(body.nutri.objetivo || "mantener").slice(0, 20),
      };
      doc.markModified("nutri");
    }
    if (body.metas && typeof body.metas === "object") {
      doc.metas = { pasos: num(body.metas.pasos), agua: num(body.metas.agua) };
      doc.markModified("metas");
    }

    await doc.save();
    return res.json(serializar(doc));
  } catch (err) {
    console.error("[salud] update:", err.message);
    return res.status(500).json({ error: "No se pudo guardar salud." });
  }
};
