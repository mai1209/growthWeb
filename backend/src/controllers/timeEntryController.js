import TimeEntry from "../models/timeEntryModel.js";

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

const serialize = (entry) => {
  const raw = typeof entry.toObject === "function" ? entry.toObject() : entry;
  return raw;
};

// GET /api/time-entries?from=YYYY-MM-DD&to=YYYY-MM-DD
export const getTimeEntries = async (req, res) => {
  try {
    const userId = req.user.id;
    const workspace = normalizeWorkspace(req);
    const query = { usuario: userId, ...buildWorkspaceQuery(workspace) };

    const { from, to, proyecto } = req.query;
    if (from || to) {
      query.inicio = {};
      if (from) query.inicio.$gte = new Date(`${from}T00:00:00`);
      if (to) query.inicio.$lte = new Date(`${to}T23:59:59.999`);
    }
    if (proyecto) query.proyecto = proyecto;

    const entries = await TimeEntry.find(query).sort({ inicio: -1 }).limit(1000);
    return res.status(200).json(entries.map(serialize));
  } catch (error) {
    return res.status(500).json({ error: "No se pudieron obtener los registros de horas" });
  }
};

const normalizeProyecto = (value) => {
  if (!value) return null;
  const s = String(value).trim();
  return /^[a-f\d]{24}$/i.test(s) ? s : null;
};

const parseEntryPayload = (body) => {
  const descripcion = String(body.descripcion || "").trim();
  const proyecto = normalizeProyecto(body.proyecto);
  const inicio = body.inicio ? new Date(body.inicio) : null;
  const fin = body.fin ? new Date(body.fin) : null;

  if (!inicio || Number.isNaN(inicio.getTime())) {
    return { error: "El inicio es inválido" };
  }
  if (!fin || Number.isNaN(fin.getTime())) {
    return { error: "El fin es inválido" };
  }
  if (fin.getTime() < inicio.getTime()) {
    return { error: "El fin no puede ser anterior al inicio" };
  }

  const span = Math.max(0, Math.round((fin.getTime() - inicio.getTime()) / 1000));
  // Con pausas, el tiempo activo real es menor que (fin - inicio): el cliente lo
  // manda en `duracion`. Lo tomamos si viene, tope el rango total.
  let duracion = span;
  if (body.duracion !== undefined && body.duracion !== null) {
    const d = Number(body.duracion);
    if (!Number.isNaN(d) && d >= 0) duracion = Math.min(Math.round(d), span);
  }
  return { descripcion, proyecto, inicio, fin, duracion };
};

// POST /api/time-entries
export const createTimeEntry = async (req, res) => {
  try {
    const userId = req.user.id;
    const workspace = normalizeWorkspace(req);
    const parsed = parseEntryPayload(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const entry = await TimeEntry.create({
      usuario: userId,
      workspace,
      proyecto: parsed.proyecto,
      descripcion: parsed.descripcion,
      inicio: parsed.inicio,
      fin: parsed.fin,
      duracion: parsed.duracion,
    });
    return res.status(201).json(serialize(entry));
  } catch (error) {
    return res.status(500).json({ error: "No se pudo guardar el registro de horas" });
  }
};

// PUT /api/time-entries/:id
export const updateTimeEntry = async (req, res) => {
  try {
    const userId = req.user.id;
    const entry = await TimeEntry.findById(req.params.id);
    if (!entry || entry.usuario.toString() !== userId) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }
    const parsed = parseEntryPayload({
      descripcion: req.body.descripcion ?? entry.descripcion,
      proyecto: req.body.proyecto ?? entry.proyecto,
      inicio: req.body.inicio ?? entry.inicio,
      fin: req.body.fin ?? entry.fin,
      duracion: req.body.duracion,
    });
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    entry.descripcion = parsed.descripcion;
    entry.proyecto = parsed.proyecto;
    entry.inicio = parsed.inicio;
    entry.fin = parsed.fin;
    entry.duracion = parsed.duracion;
    await entry.save();
    return res.status(200).json(serialize(entry));
  } catch (error) {
    return res.status(500).json({ error: "No se pudo actualizar el registro" });
  }
};

// DELETE /api/time-entries/:id
export const deleteTimeEntry = async (req, res) => {
  try {
    const userId = req.user.id;
    const entry = await TimeEntry.findById(req.params.id);
    if (!entry || entry.usuario.toString() !== userId) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }
    await entry.deleteOne();
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo eliminar el registro" });
  }
};
