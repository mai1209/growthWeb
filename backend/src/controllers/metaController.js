import Meta from "../models/metaModel.js";

const MAX_HITOS = 40;
const MAX_TEXTO = 300;

const normalizeWorkspaceValue = (value) => {
  const workspace = String(value || "").trim();
  return /^business(?::[a-f\d]{24})?$/i.test(workspace) ? workspace : "personal";
};

const normalizeWorkspace = (req) =>
  normalizeWorkspaceValue(req.query.workspace || req.body.workspace || req.headers["x-workspace"]);

const buildWorkspaceQuery = (workspace) =>
  workspace !== "personal"
    ? { workspace }
    : { $or: [{ workspace: "personal" }, { workspace: { $exists: false } }] };

const esFecha = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

const limpiarHitos = (valor) => {
  if (!Array.isArray(valor)) return null;
  return valor
    .filter((h) => h && String(h.texto || "").trim())
    .slice(0, MAX_HITOS)
    .map((h) => ({
      texto: String(h.texto).trim().slice(0, MAX_TEXTO),
      hecho: Boolean(h.hecho),
    }));
};

// Aplica al documento sólo los campos presentes en el body.
const aplicarCampos = (meta, body) => {
  if (typeof body.titulo === "string" && body.titulo.trim()) {
    meta.titulo = body.titulo.trim().slice(0, MAX_TEXTO);
  }
  if (typeof body.descripcion === "string") {
    meta.descripcion = body.descripcion.trim().slice(0, 2000);
  }
  if (["corto", "mediano", "largo"].includes(body.horizonte)) {
    meta.horizonte = body.horizonte;
  }
  if (typeof body.area === "string") meta.area = body.area.trim().slice(0, 60);
  if (typeof body.fechaObjetivo === "string") {
    meta.fechaObjetivo = esFecha(body.fechaObjetivo) ? body.fechaObjetivo : "";
  }
  if (["hitos", "numero", "manual"].includes(body.medicion)) {
    meta.medicion = body.medicion;
  }
  const hitos = limpiarHitos(body.hitos);
  if (hitos) meta.hitos = hitos;
  if (Number.isFinite(Number(body.objetivoNumero))) {
    meta.objetivoNumero = Math.max(0, Number(body.objetivoNumero));
  }
  if (Number.isFinite(Number(body.actualNumero))) {
    meta.actualNumero = Math.max(0, Number(body.actualNumero));
  }
  if (typeof body.unidad === "string") meta.unidad = body.unidad.trim().slice(0, 20);
  if (Number.isFinite(Number(body.progresoManual))) {
    meta.progresoManual = Math.min(100, Math.max(0, Number(body.progresoManual)));
  }
  if (["activa", "pausada", "completada"].includes(body.estado)) {
    meta.estado = body.estado;
    if (body.estado === "completada" && !meta.completadaEn) {
      meta.completadaEn = esFecha(body.fechaLocal)
        ? body.fechaLocal
        : new Date().toISOString().slice(0, 10);
    }
    if (body.estado !== "completada") meta.completadaEn = "";
  }
};

const serialize = (meta) => (typeof meta.toObject === "function" ? meta.toObject() : meta);

// GET /api/metas
export const getMetas = async (req, res) => {
  try {
    const workspace = normalizeWorkspace(req);
    const metas = await Meta.find({
      usuario: req.user.id,
      ...buildWorkspaceQuery(workspace),
    }).sort({ createdAt: -1 });
    return res.status(200).json(metas.map(serialize));
  } catch (error) {
    return res.status(500).json({ error: "No se pudieron obtener las metas" });
  }
};

// POST /api/metas
export const createMeta = async (req, res) => {
  try {
    const workspace = normalizeWorkspace(req);
    const titulo = String(req.body.titulo || "").trim();
    if (!titulo) return res.status(400).json({ error: "El título es obligatorio" });

    const meta = new Meta({ usuario: req.user.id, workspace, titulo });
    aplicarCampos(meta, req.body);
    await meta.save();
    return res.status(201).json(serialize(meta));
  } catch (error) {
    return res.status(500).json({ error: "No se pudo crear la meta" });
  }
};

// PUT /api/metas/:id
export const updateMeta = async (req, res) => {
  try {
    const meta = await Meta.findOne({ _id: req.params.id, usuario: req.user.id });
    if (!meta) return res.status(404).json({ error: "Meta no encontrada" });

    aplicarCampos(meta, req.body);
    await meta.save();
    return res.status(200).json(serialize(meta));
  } catch (error) {
    return res.status(500).json({ error: "No se pudo actualizar la meta" });
  }
};

// DELETE /api/metas/:id
export const deleteMeta = async (req, res) => {
  try {
    const meta = await Meta.findOneAndDelete({ _id: req.params.id, usuario: req.user.id });
    if (!meta) return res.status(404).json({ error: "Meta no encontrada" });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo eliminar la meta" });
  }
};
