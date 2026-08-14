import mongoose from "mongoose";
import Message from "../models/messageModel.js";
import ChatRead from "../models/chatReadModel.js";
import GroupMember from "../models/groupMemberModel.js";
import User from "../models/userModel.js";

const pubUser = (u) => ({
  id: u._id,
  username: u.username,
  fullName: u.fullName || "",
  foto: u.profilePhotoUrl || "",
});

const dmConvo = (a, b) => `d:${[String(a), String(b)].sort().join("_")}`;
const grupoConvo = (id) => `g:${id}`;

const serializar = (m) => ({
  id: m._id,
  texto: m.texto,
  createdAt: m.createdAt,
  autor: m.autor && m.autor.username ? pubUser(m.autor) : { id: m.autor },
});

const marcarVisto = (usuario, convo) =>
  ChatRead.updateOne({ usuario, convo }, { lastSeen: new Date() }, { upsert: true }).catch(() => {});

// ---------------- DM (privado) ----------------

// POST /api/community/chat/dm/:userId — { texto }
export const enviarDM = async (req, res) => {
  try {
    const { userId } = req.params;
    const texto = String(req.body?.texto || "").trim();
    if (!texto) return res.status(400).json({ error: "Escribí algo." });
    if (String(userId) === String(req.userId))
      return res.status(400).json({ error: "No podés escribirte a vos mismo." });
    if (!(await User.exists({ _id: userId }))) return res.status(404).json({ error: "Usuario no encontrado" });
    const convo = dmConvo(req.userId, userId);
    const msg = await Message.create({
      convo,
      autor: req.userId,
      participantes: [req.userId, userId],
      texto: texto.slice(0, 2000),
    });
    await marcarVisto(req.userId, convo);
    const full = await Message.findById(msg._id).populate("autor", "username fullName profilePhotoUrl");
    return res.json({ mensaje: serializar(full) });
  } catch (err) {
    console.error("[chat] enviarDM:", err.message);
    return res.status(500).json({ error: "No se pudo enviar." });
  }
};

// GET /api/community/chat/dm/:userId — mensajes de la conversación + el otro usuario.
export const getDM = async (req, res) => {
  try {
    const { userId } = req.params;
    const convo = dmConvo(req.userId, userId);
    const [mensajes, otro] = await Promise.all([
      Message.find({ convo }).sort({ createdAt: 1 }).limit(200).populate("autor", "username fullName profilePhotoUrl"),
      User.findById(userId).select("username fullName profilePhotoUrl"),
    ]);
    await marcarVisto(req.userId, convo);
    return res.json({ mensajes: mensajes.map(serializar), usuario: otro ? pubUser(otro) : null });
  } catch (err) {
    console.error("[chat] getDM:", err.message);
    return res.status(500).json({ error: "No se pudo cargar el chat." });
  }
};

// GET /api/community/chat/conversaciones — bandeja de DMs (con no leídos).
export const getConversaciones = async (req, res) => {
  try {
    const meId = new mongoose.Types.ObjectId(req.userId);
    const convos = await Message.aggregate([
      { $match: { participantes: meId } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$convo",
          texto: { $first: "$texto" },
          createdAt: { $first: "$createdAt" },
          participantes: { $first: "$participantes" },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 40 },
    ]);
    const convoIds = convos.map((c) => c._id);
    const reads = await ChatRead.find({ usuario: req.userId, convo: { $in: convoIds } });
    const readMap = new Map(reads.map((r) => [r.convo, r.lastSeen]));
    const otherIds = convos
      .map((c) => (c.participantes || []).find((p) => String(p) !== String(req.userId)))
      .filter(Boolean);
    const users = await User.find({ _id: { $in: otherIds } }).select("username fullName profilePhotoUrl");
    const userMap = new Map(users.map((u) => [String(u._id), u]));
    const items = await Promise.all(
      convos.map(async (c) => {
        const otherId = (c.participantes || []).find((p) => String(p) !== String(req.userId));
        const u = userMap.get(String(otherId));
        const lastSeen = readMap.get(c._id) || new Date(0);
        const noLeidos = await Message.countDocuments({
          convo: c._id,
          createdAt: { $gt: lastSeen },
          autor: { $ne: req.userId },
        });
        return { usuario: u ? pubUser(u) : null, ultimo: c.texto, cuando: c.createdAt, noLeidos };
      })
    );
    return res.json({ conversaciones: items.filter((x) => x.usuario) });
  } catch (err) {
    console.error("[chat] getConversaciones:", err.message);
    return res.status(500).json({ error: "No se pudieron cargar las conversaciones." });
  }
};

// GET /api/community/chat/no-leidos — total de mensajes DM sin leer (badge).
export const getNoLeidosChat = async (req, res) => {
  try {
    const meId = new mongoose.Types.ObjectId(req.userId);
    const convos = await Message.distinct("convo", { participantes: meId });
    const reads = await ChatRead.find({ usuario: req.userId, convo: { $in: convos } });
    const readMap = new Map(reads.map((r) => [r.convo, r.lastSeen]));
    let total = 0;
    for (const c of convos) {
      const lastSeen = readMap.get(c) || new Date(0);
      total += await Message.countDocuments({ convo: c, createdAt: { $gt: lastSeen }, autor: { $ne: req.userId } });
    }
    return res.json({ noLeidos: total });
  } catch (err) {
    console.error("[chat] getNoLeidosChat:", err.message);
    return res.status(500).json({ error: "No se pudo." });
  }
};

// ---------------- Chat de club (público entre miembros) ----------------

// POST /api/community/chat/grupo/:grupoId — { texto }
export const enviarGrupo = async (req, res) => {
  try {
    const { grupoId } = req.params;
    const texto = String(req.body?.texto || "").trim();
    if (!texto) return res.status(400).json({ error: "Escribí algo." });
    if (!(await GroupMember.exists({ group: grupoId, user: req.userId })))
      return res.status(403).json({ error: "No sos miembro de este club." });
    const convo = grupoConvo(grupoId);
    const msg = await Message.create({ convo, autor: req.userId, grupo: grupoId, texto: texto.slice(0, 2000) });
    await marcarVisto(req.userId, convo);
    const full = await Message.findById(msg._id).populate("autor", "username fullName profilePhotoUrl");
    return res.json({ mensaje: serializar(full) });
  } catch (err) {
    console.error("[chat] enviarGrupo:", err.message);
    return res.status(500).json({ error: "No se pudo enviar." });
  }
};

// GET /api/community/chat/grupo/:grupoId — mensajes del chat del club.
export const getGrupoChat = async (req, res) => {
  try {
    const { grupoId } = req.params;
    if (!(await GroupMember.exists({ group: grupoId, user: req.userId })))
      return res.status(403).json({ error: "No sos miembro de este club." });
    const convo = grupoConvo(grupoId);
    const mensajes = await Message.find({ convo })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate("autor", "username fullName profilePhotoUrl");
    await marcarVisto(req.userId, convo);
    return res.json({ mensajes: mensajes.map(serializar) });
  } catch (err) {
    console.error("[chat] getGrupoChat:", err.message);
    return res.status(500).json({ error: "No se pudo cargar el chat." });
  }
};
