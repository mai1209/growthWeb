import Group from "../models/groupModel.js";
import GroupMember from "../models/groupMemberModel.js";
import User from "../models/userModel.js";

const pubUser = (u) => ({
  id: u._id,
  username: u.username,
  fullName: u.fullName || "",
  foto: u.profilePhotoUrl || "",
});

const DEPORTES = ["caminata", "carrera", "bici", "mixto"];

const serializarGrupo = (g, extra = {}) => ({
  id: g._id,
  nombre: g.nombre,
  descripcion: g.descripcion || "",
  deporte: DEPORTES.includes(g.deporte) ? g.deporte : "mixto",
  zona: g.zona || "",
  foto: g.foto || "",
  publico: g.publico !== false,
  owner: g.owner,
  ...extra,
});

// POST /api/community/grupos — crea un club (el creador queda de owner + miembro).
export const crearGrupo = async (req, res) => {
  try {
    const { nombre, descripcion, deporte, zona, foto } = req.body || {};
    if (!String(nombre || "").trim()) return res.status(400).json({ error: "Poné un nombre." });
    const grupo = await Group.create({
      nombre: String(nombre).slice(0, 60),
      descripcion: String(descripcion || "").slice(0, 400),
      deporte: DEPORTES.includes(deporte) ? deporte : "mixto",
      zona: String(zona || "").slice(0, 80),
      foto: typeof foto === "string" ? foto.slice(0, 2000000) : "",
      owner: req.userId,
    });
    await GroupMember.create({ group: grupo._id, user: req.userId, rol: "owner" });
    return res.json({ grupo: serializarGrupo(grupo, { miembros: 1, soyMiembro: true, soyOwner: true }) });
  } catch (err) {
    console.error("[grupos] crear:", err.message);
    return res.status(500).json({ error: "No se pudo crear el club." });
  }
};

// GET /api/community/grupos?q=... — descubrir clubes públicos.
export const descubrirGrupos = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 40);
    const filtro = { publico: { $ne: false } };
    if (q.length >= 2) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filtro.$or = [{ nombre: rx }, { zona: rx }];
    }
    const grupos = await Group.find(filtro).sort({ createdAt: -1 }).limit(30);
    const ids = grupos.map((g) => g._id);
    const [counts, mios] = await Promise.all([
      GroupMember.aggregate([{ $match: { group: { $in: ids } } }, { $group: { _id: "$group", n: { $sum: 1 } } }]),
      GroupMember.find({ user: req.userId, group: { $in: ids } }).select("group"),
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
    const mioSet = new Set(mios.map((m) => String(m.group)));
    return res.json({
      grupos: grupos.map((g) =>
        serializarGrupo(g, { miembros: countMap.get(String(g._id)) || 0, soyMiembro: mioSet.has(String(g._id)) })
      ),
    });
  } catch (err) {
    console.error("[grupos] descubrir:", err.message);
    return res.status(500).json({ error: "No se pudieron cargar los clubes." });
  }
};

// GET /api/community/grupos/mios — clubes a los que pertenezco.
export const misGrupos = async (req, res) => {
  try {
    const membresias = await GroupMember.find({ user: req.userId }).select("group");
    const ids = membresias.map((m) => m.group);
    const grupos = await Group.find({ _id: { $in: ids } }).sort({ createdAt: -1 });
    const counts = await GroupMember.aggregate([
      { $match: { group: { $in: ids } } },
      { $group: { _id: "$group", n: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
    return res.json({
      grupos: grupos.map((g) =>
        serializarGrupo(g, {
          miembros: countMap.get(String(g._id)) || 0,
          soyMiembro: true,
          soyOwner: String(g.owner) === String(req.userId),
        })
      ),
    });
  } catch (err) {
    console.error("[grupos] mios:", err.message);
    return res.status(500).json({ error: "No se pudieron cargar tus clubes." });
  }
};

// GET /api/community/grupos/:id — detalle.
export const getGrupo = async (req, res) => {
  try {
    const g = await Group.findById(req.params.id);
    if (!g) return res.status(404).json({ error: "Club no encontrado" });
    const [miembros, soyMiembro] = await Promise.all([
      GroupMember.countDocuments({ group: g._id }),
      GroupMember.exists({ group: g._id, user: req.userId }),
    ]);
    return res.json({
      grupo: serializarGrupo(g, {
        miembros,
        soyMiembro: !!soyMiembro,
        soyOwner: String(g.owner) === String(req.userId),
      }),
    });
  } catch (err) {
    console.error("[grupos] get:", err.message);
    return res.status(500).json({ error: "No se pudo cargar el club." });
  }
};

// POST /api/community/grupos/:id/join
export const unirse = async (req, res) => {
  try {
    const g = await Group.findById(req.params.id).select("_id");
    if (!g) return res.status(404).json({ error: "Club no encontrado" });
    await GroupMember.updateOne(
      { group: g._id, user: req.userId },
      { $setOnInsert: { group: g._id, user: req.userId, rol: "miembro" } },
      { upsert: true }
    );
    const miembros = await GroupMember.countDocuments({ group: g._id });
    return res.json({ soyMiembro: true, miembros });
  } catch (err) {
    console.error("[grupos] unirse:", err.message);
    return res.status(500).json({ error: "No se pudo unir." });
  }
};

// DELETE /api/community/grupos/:id/join
export const salir = async (req, res) => {
  try {
    await GroupMember.deleteOne({ group: req.params.id, user: req.userId });
    const miembros = await GroupMember.countDocuments({ group: req.params.id });
    return res.json({ soyMiembro: false, miembros });
  } catch (err) {
    console.error("[grupos] salir:", err.message);
    return res.status(500).json({ error: "No se pudo salir." });
  }
};

// GET /api/community/grupos/:id/miembros
export const miembrosGrupo = async (req, res) => {
  try {
    const ms = await GroupMember.find({ group: req.params.id }).select("user rol").limit(200);
    const users = await User.find({ _id: { $in: ms.map((m) => m.user) } }).select(
      "username fullName profilePhotoUrl"
    );
    const rolMap = new Map(ms.map((m) => [String(m.user), m.rol]));
    return res.json({
      miembros: users.map((u) => ({ ...pubUser(u), rol: rolMap.get(String(u._id)) || "miembro" })),
    });
  } catch (err) {
    console.error("[grupos] miembros:", err.message);
    return res.status(500).json({ error: "No se pudieron cargar los miembros." });
  }
};

// PUT /api/community/grupos/:id — editar (solo el owner). Por ahora foto + datos básicos.
export const editarGrupo = async (req, res) => {
  try {
    const g = await Group.findById(req.params.id);
    if (!g) return res.status(404).json({ error: "Club no encontrado" });
    if (String(g.owner) !== String(req.userId)) return res.status(403).json({ error: "No es tu club." });
    const { nombre, descripcion, deporte, zona, foto } = req.body || {};
    if (typeof nombre === "string" && nombre.trim()) g.nombre = nombre.slice(0, 60);
    if (typeof descripcion === "string") g.descripcion = descripcion.slice(0, 400);
    if (DEPORTES.includes(deporte)) g.deporte = deporte;
    if (typeof zona === "string") g.zona = zona.slice(0, 80);
    if (typeof foto === "string") g.foto = foto.slice(0, 2000000);
    await g.save();
    const miembros = await GroupMember.countDocuments({ group: g._id });
    return res.json({ grupo: serializarGrupo(g, { miembros, soyMiembro: true, soyOwner: true }) });
  } catch (err) {
    console.error("[grupos] editar:", err.message);
    return res.status(500).json({ error: "No se pudo guardar." });
  }
};

// DELETE /api/community/grupos/:id — solo el owner.
export const borrarGrupo = async (req, res) => {
  try {
    const g = await Group.findById(req.params.id).select("owner");
    if (!g) return res.status(404).json({ error: "Club no encontrado" });
    if (String(g.owner) !== String(req.userId)) return res.status(403).json({ error: "No es tu club." });
    await GroupMember.deleteMany({ group: g._id });
    await Group.deleteOne({ _id: g._id });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[grupos] borrar:", err.message);
    return res.status(500).json({ error: "No se pudo borrar el club." });
  }
};
