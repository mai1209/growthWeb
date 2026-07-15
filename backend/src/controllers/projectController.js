import Project from "../models/projectModel.js";
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

const serialize = (project) =>
  typeof project.toObject === "function" ? project.toObject() : project;

// GET /api/projects
export const getProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    const workspace = normalizeWorkspace(req);
    const projects = await Project.find({
      usuario: userId,
      ...buildWorkspaceQuery(workspace),
    }).sort({ createdAt: -1 });
    return res.status(200).json(projects.map(serialize));
  } catch (error) {
    return res.status(500).json({ error: "No se pudieron obtener los proyectos" });
  }
};

// POST /api/projects
export const createProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const workspace = normalizeWorkspace(req);
    const nombre = String(req.body.nombre || "").trim();
    if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });

    const color = String(req.body.color || "#5dc72d").trim();
    const project = await Project.create({ usuario: userId, workspace, nombre, color });
    return res.status(201).json(serialize(project));
  } catch (error) {
    return res.status(500).json({ error: "No se pudo crear el proyecto" });
  }
};

// PUT /api/projects/:id
export const updateProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const project = await Project.findById(req.params.id);
    if (!project || project.usuario.toString() !== userId) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }
    if (req.body.nombre !== undefined) {
      const nombre = String(req.body.nombre).trim();
      if (!nombre) return res.status(400).json({ error: "El nombre es obligatorio" });
      project.nombre = nombre;
    }
    if (req.body.color !== undefined) project.color = String(req.body.color).trim();
    if (req.body.archivado !== undefined) project.archivado = Boolean(req.body.archivado);
    await project.save();
    return res.status(200).json(serialize(project));
  } catch (error) {
    return res.status(500).json({ error: "No se pudo actualizar el proyecto" });
  }
};

// DELETE /api/projects/:id  (las sesiones quedan como "Sin proyecto")
export const deleteProject = async (req, res) => {
  try {
    const userId = req.user.id;
    const project = await Project.findById(req.params.id);
    if (!project || project.usuario.toString() !== userId) {
      return res.status(404).json({ error: "Proyecto no encontrado" });
    }
    await TimeEntry.updateMany(
      { usuario: userId, proyecto: project._id },
      { $set: { proyecto: null } }
    );
    await project.deleteOne();
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: "No se pudo eliminar el proyecto" });
  }
};
