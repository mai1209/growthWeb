import Gym from "../models/gymModel.js";

const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const str = (v, max) => String(v || "").slice(0, max);

const MAX_DIAS = 120; // ~4 meses de entrenos guardados
const MAX_EJ_DIA = 30; // ejercicios por día
const MAX_SETS = 20; // series por ejercicio
const MAX_RUTINAS = 40;
const MAX_EJ_RUTINA = 40;
const MAX_EJERCICIOS = 200;

// Un ejercicio registrado en un día: nombre + sus series.
const limpiarEjercicioDia = (e) => ({
  id: str(e?.id, 40),
  nombre: str(e?.nombre, 80),
  grupo: str(e?.grupo, 40),
  sets: (Array.isArray(e?.sets) ? e.sets : []).slice(0, MAX_SETS).map((s) => ({
    kg: num(s?.kg),
    reps: num(s?.reps),
    hecha: Boolean(s?.hecha),
  })),
});

const limpiarEntrenoDia = (arr) =>
  (Array.isArray(arr) ? arr : []).slice(0, MAX_EJ_DIA).map(limpiarEjercicioDia);

// Mergea entrenos por día: el día que viene en el body pisa el guardado.
const mergeEntrenos = (actual, entrante) => {
  const base = actual && typeof actual === "object" ? { ...actual } : {};
  Object.keys(entrante || {}).forEach((k) => {
    if (!esFecha(k)) return;
    base[k] = limpiarEntrenoDia(entrante[k]);
  });
  const recortado = {};
  Object.keys(base)
    .sort()
    .slice(-MAX_DIAS)
    .forEach((k) => {
      recortado[k] = base[k];
    });
  return recortado;
};

const limpiarRutinas = (arr) =>
  (Array.isArray(arr) ? arr : []).slice(0, MAX_RUTINAS).map((r) => ({
    id: str(r?.id, 40),
    nombre: str(r?.nombre, 60),
    dia: str(r?.dia, 20),
    ejercicios: (Array.isArray(r?.ejercicios) ? r.ejercicios : []).slice(0, MAX_EJ_RUTINA).map((e) => ({
      nombre: str(e?.nombre, 80),
      grupo: str(e?.grupo, 40),
      series: num(e?.series),
      reps: num(e?.reps),
    })),
  }));

const limpiarEjercicios = (arr) =>
  (Array.isArray(arr) ? arr : []).slice(0, MAX_EJERCICIOS).map((e) => ({
    id: str(e?.id, 40),
    nombre: str(e?.nombre, 80),
    grupo: str(e?.grupo, 40),
  }));

const obtenerDoc = async (userId) => {
  const existente = await Gym.findOne({ usuario: userId });
  if (existente) return existente;
  return Gym.create({ usuario: userId });
};

const serializar = (doc) => ({
  ejercicios: doc.ejercicios || [],
  rutinas: doc.rutinas || [],
  entrenos: doc.entrenos || {},
  updatedAt: doc.updatedAt,
});

// GET /api/gym
export const getGym = async (req, res) => {
  try {
    const doc = await obtenerDoc(req.userId);
    return res.json(serializar(doc));
  } catch (err) {
    console.error("[gym] get:", err.message);
    return res.status(500).json({ error: "No se pudo cargar gym." });
  }
};

// PUT /api/gym — el body trae solo lo que quiere actualizar.
export const updateGym = async (req, res) => {
  try {
    const body = req.body || {};
    const doc = await obtenerDoc(req.userId);

    if (body.entrenos && typeof body.entrenos === "object") {
      doc.entrenos = mergeEntrenos(doc.entrenos, body.entrenos);
      doc.markModified("entrenos");
    }
    if (Array.isArray(body.rutinas)) {
      doc.rutinas = limpiarRutinas(body.rutinas);
      doc.markModified("rutinas");
    }
    if (Array.isArray(body.ejercicios)) {
      doc.ejercicios = limpiarEjercicios(body.ejercicios);
      doc.markModified("ejercicios");
    }

    await doc.save();
    return res.json(serializar(doc));
  } catch (err) {
    console.error("[gym] update:", err.message);
    return res.status(500).json({ error: "No se pudo guardar gym." });
  }
};
