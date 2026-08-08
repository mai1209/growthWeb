import Challenge from "../models/challengeModel.js";
import ChallengeMember from "../models/challengeMemberModel.js";
import Salud from "../models/saludModel.js";
import User from "../models/userModel.js";
import Follow from "../models/followModel.js";

const pubUser = (u) => ({
  id: u._id,
  username: u.username,
  fullName: u.fullName || "",
  foto: u.profilePhotoUrl || "",
});

const DEPORTES = ["caminata", "carrera", "bici", "mixto"];
const isFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

const serializar = (r, extra = {}) => ({
  id: r._id,
  nombre: r.nombre,
  descripcion: r.descripcion || "",
  tipo: r.tipo || "distancia",
  meta: r.meta,
  deporte: DEPORTES.includes(r.deporte) ? r.deporte : "mixto",
  inicio: r.inicio,
  fin: r.fin,
  foto: r.foto || "",
  creador: r.creador,
  ...extra,
});

// Metros de un usuario dentro del período (y deporte). Las fechas son strings
// "YYYY-MM-DD", así que la comparación lexicográfica alcanza para el rango.
const sumMetros = (caminatas, inicio, fin, deporte) =>
  (caminatas || []).reduce((acc, c) => {
    if (!c || !c.fecha) return acc;
    if (c.fecha < inicio || c.fecha > fin) return acc;
    const t = c.tipo || "caminata"; // caminatas viejas sin tipo = caminata
    if (deporte && deporte !== "mixto" && t !== deporte) return acc;
    return acc + (Number(c.metros) || 0);
  }, 0);

// POST /api/community/retos — crea un reto (el creador queda apuntado).
export const crearReto = async (req, res) => {
  try {
    const { nombre, descripcion, meta, deporte, inicio, fin, foto } = req.body || {};
    if (!String(nombre || "").trim()) return res.status(400).json({ error: "Poné un nombre." });
    const metaNum = Math.round(Number(meta) || 0);
    if (metaNum <= 0) return res.status(400).json({ error: "Poné una meta válida." });
    if (!isFecha(inicio) || !isFecha(fin) || fin < inicio)
      return res.status(400).json({ error: "Revisá las fechas." });
    const reto = await Challenge.create({
      nombre: String(nombre).slice(0, 80),
      descripcion: String(descripcion || "").slice(0, 400),
      meta: metaNum,
      deporte: DEPORTES.includes(deporte) ? deporte : "mixto",
      inicio,
      fin,
      foto: typeof foto === "string" ? foto.slice(0, 2000000) : "",
      creador: req.userId,
    });
    await ChallengeMember.create({ challenge: reto._id, user: req.userId });
    return res.json({
      reto: serializar(reto, { participantes: 1, meApunto: true, miProgreso: 0, soyCreador: true }),
    });
  } catch (err) {
    console.error("[retos] crear:", err.message);
    return res.status(500).json({ error: "No se pudo crear el reto." });
  }
};

// GET /api/community/retos?q=... — descubrir retos públicos.
export const descubrirRetos = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 40);
    const filtro = { publico: { $ne: false } };
    if (q.length >= 2) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filtro.nombre = rx;
    }
    const retos = await Challenge.find(filtro).sort({ createdAt: -1 }).limit(30);
    const ids = retos.map((r) => r._id);
    const [counts, mios] = await Promise.all([
      ChallengeMember.aggregate([
        { $match: { challenge: { $in: ids } } },
        { $group: { _id: "$challenge", n: { $sum: 1 } } },
      ]),
      ChallengeMember.find({ user: req.userId, challenge: { $in: ids } }).select("challenge"),
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
    const mioSet = new Set(mios.map((m) => String(m.challenge)));
    return res.json({
      retos: retos.map((r) =>
        serializar(r, {
          participantes: countMap.get(String(r._id)) || 0,
          meApunto: mioSet.has(String(r._id)),
        })
      ),
    });
  } catch (err) {
    console.error("[retos] descubrir:", err.message);
    return res.status(500).json({ error: "No se pudieron cargar los retos." });
  }
};

// GET /api/community/retos/mios — retos a los que estoy apuntada (con mi progreso).
export const misRetos = async (req, res) => {
  try {
    const membresias = await ChallengeMember.find({ user: req.userId }).select("challenge");
    const ids = membresias.map((m) => m.challenge);
    const [retos, counts, salud] = await Promise.all([
      Challenge.find({ _id: { $in: ids } }).sort({ createdAt: -1 }),
      ChallengeMember.aggregate([
        { $match: { challenge: { $in: ids } } },
        { $group: { _id: "$challenge", n: { $sum: 1 } } },
      ]),
      Salud.findOne({ usuario: req.userId }).select("caminatas"),
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
    const cam = salud?.caminatas || [];
    return res.json({
      retos: retos.map((r) =>
        serializar(r, {
          participantes: countMap.get(String(r._id)) || 0,
          meApunto: true,
          soyCreador: String(r.creador) === String(req.userId),
          miProgreso: sumMetros(cam, r.inicio, r.fin, r.deporte),
        })
      ),
    });
  } catch (err) {
    console.error("[retos] mios:", err.message);
    return res.status(500).json({ error: "No se pudieron cargar tus retos." });
  }
};

// GET /api/community/retos/:id — detalle + mi progreso.
export const getReto = async (req, res) => {
  try {
    const r = await Challenge.findById(req.params.id);
    if (!r) return res.status(404).json({ error: "Reto no encontrado" });
    const [participantes, meApunto, salud] = await Promise.all([
      ChallengeMember.countDocuments({ challenge: r._id }),
      ChallengeMember.exists({ challenge: r._id, user: req.userId }),
      Salud.findOne({ usuario: req.userId }).select("caminatas"),
    ]);
    return res.json({
      reto: serializar(r, {
        participantes,
        meApunto: !!meApunto,
        soyCreador: String(r.creador) === String(req.userId),
        miProgreso: sumMetros(salud?.caminatas || [], r.inicio, r.fin, r.deporte),
      }),
    });
  } catch (err) {
    console.error("[retos] get:", err.message);
    return res.status(500).json({ error: "No se pudo cargar el reto." });
  }
};

// POST /api/community/retos/:id/join
export const unirseReto = async (req, res) => {
  try {
    const r = await Challenge.findById(req.params.id).select("_id");
    if (!r) return res.status(404).json({ error: "Reto no encontrado" });
    await ChallengeMember.updateOne(
      { challenge: r._id, user: req.userId },
      { $setOnInsert: { challenge: r._id, user: req.userId } },
      { upsert: true }
    );
    const participantes = await ChallengeMember.countDocuments({ challenge: r._id });
    return res.json({ meApunto: true, participantes });
  } catch (err) {
    console.error("[retos] unirse:", err.message);
    return res.status(500).json({ error: "No se pudo unir." });
  }
};

// DELETE /api/community/retos/:id/join
export const salirReto = async (req, res) => {
  try {
    await ChallengeMember.deleteOne({ challenge: req.params.id, user: req.userId });
    const participantes = await ChallengeMember.countDocuments({ challenge: req.params.id });
    return res.json({ meApunto: false, participantes });
  } catch (err) {
    console.error("[retos] salir:", err.message);
    return res.status(500).json({ error: "No se pudo salir." });
  }
};

// GET /api/community/retos/:id/ranking — tabla de posiciones (metros por participante).
export const rankingReto = async (req, res) => {
  try {
    const r = await Challenge.findById(req.params.id);
    if (!r) return res.status(404).json({ error: "Reto no encontrado" });
    const ms = await ChallengeMember.find({ challenge: r._id }).select("user").limit(500);
    const userIds = ms.map((m) => m.user);
    const [users, saludDocs, sigo] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select("username fullName profilePhotoUrl"),
      Salud.find({ usuario: { $in: userIds } }).select("usuario caminatas"),
      Follow.find({ seguidor: req.userId, seguido: { $in: userIds } }).select("seguido"),
    ]);
    const userMap = new Map(users.map((u) => [String(u._id), u]));
    const camMap = new Map(saludDocs.map((s) => [String(s.usuario), s.caminatas || []]));
    const sigoSet = new Set(sigo.map((f) => String(f.seguido)));
    const ranking = userIds
      .map((uid) => {
        const u = userMap.get(String(uid));
        if (!u) return null;
        return {
          ...pubUser(u),
          metros: sumMetros(camMap.get(String(uid)) || [], r.inicio, r.fin, r.deporte),
          loSigo: sigoSet.has(String(uid)),
          esYo: String(uid) === String(req.userId),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.metros - a.metros)
      .slice(0, 100);
    return res.json({ ranking, meta: r.meta });
  } catch (err) {
    console.error("[retos] ranking:", err.message);
    return res.status(500).json({ error: "No se pudo cargar el ranking." });
  }
};

// PUT /api/community/retos/:id — editar (solo el creador). Por ahora foto + datos básicos.
export const editarReto = async (req, res) => {
  try {
    const r = await Challenge.findById(req.params.id);
    if (!r) return res.status(404).json({ error: "Reto no encontrado" });
    if (String(r.creador) !== String(req.userId)) return res.status(403).json({ error: "No es tu reto." });
    const { nombre, descripcion, deporte, foto } = req.body || {};
    if (typeof nombre === "string" && nombre.trim()) r.nombre = nombre.slice(0, 80);
    if (typeof descripcion === "string") r.descripcion = descripcion.slice(0, 400);
    if (DEPORTES.includes(deporte)) r.deporte = deporte;
    if (typeof foto === "string") r.foto = foto.slice(0, 2000000);
    await r.save();
    const [participantes, salud] = await Promise.all([
      ChallengeMember.countDocuments({ challenge: r._id }),
      Salud.findOne({ usuario: req.userId }).select("caminatas"),
    ]);
    return res.json({
      reto: serializar(r, {
        participantes,
        meApunto: true,
        soyCreador: true,
        miProgreso: sumMetros(salud?.caminatas || [], r.inicio, r.fin, r.deporte),
      }),
    });
  } catch (err) {
    console.error("[retos] editar:", err.message);
    return res.status(500).json({ error: "No se pudo guardar." });
  }
};

// DELETE /api/community/retos/:id — solo el creador.
export const borrarReto = async (req, res) => {
  try {
    const r = await Challenge.findById(req.params.id).select("creador");
    if (!r) return res.status(404).json({ error: "Reto no encontrado" });
    if (String(r.creador) !== String(req.userId)) return res.status(403).json({ error: "No es tu reto." });
    await ChallengeMember.deleteMany({ challenge: r._id });
    await Challenge.deleteOne({ _id: r._id });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[retos] borrar:", err.message);
    return res.status(500).json({ error: "No se pudo borrar el reto." });
  }
};
