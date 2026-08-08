import User from "../models/userModel.js";
import Follow from "../models/followModel.js";
import Post from "../models/postModel.js";
import Comment from "../models/commentModel.js";
import GroupMember from "../models/groupMemberModel.js";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

// Datos públicos de un usuario (lo que se muestra en la comunidad).
const pubUser = (u) => ({
  id: u._id,
  username: u.username,
  fullName: u.fullName || "",
  foto: u.profilePhotoUrl || "",
  bio: u.bio || "",
});

// ---------------- PERFIL ----------------

// GET /api/community/me — mi perfil de comunidad + contadores.
export const getMiPerfil = async (req, res) => {
  try {
    const u = await User.findById(req.userId).select(
      "username fullName profilePhotoUrl bannerUrl bio perfilPublico"
    );
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });
    const [seguidores, siguiendo, posteos] = await Promise.all([
      Follow.countDocuments({ seguido: u._id }),
      Follow.countDocuments({ seguidor: u._id }),
      Post.countDocuments({ autor: u._id, group: null }),
    ]);
    return res.json({
      ...pubUser(u),
      banner: u.bannerUrl || "",
      perfilPublico: u.perfilPublico !== false,
      stats: { seguidores, siguiendo, posteos },
    });
  } catch (err) {
    console.error("[community] getMiPerfil:", err.message);
    return res.status(500).json({ error: "No se pudo cargar el perfil." });
  }
};

// PUT /api/community/me — { bio, perfilPublico }
export const updateMiPerfil = async (req, res) => {
  try {
    const upd = {};
    if (typeof req.body.bio === "string") upd.bio = req.body.bio.slice(0, 160);
    if (typeof req.body.perfilPublico === "boolean") upd.perfilPublico = req.body.perfilPublico;
    const u = await User.findByIdAndUpdate(req.userId, upd, { new: true }).select(
      "username fullName profilePhotoUrl bio perfilPublico"
    );
    return res.json({ ...pubUser(u), perfilPublico: u.perfilPublico !== false });
  } catch (err) {
    console.error("[community] updateMiPerfil:", err.message);
    return res.status(500).json({ error: "No se pudo guardar el perfil." });
  }
};

// GET /api/community/users/:username — perfil público de otro usuario.
export const getPerfil = async (req, res) => {
  try {
    const u = await User.findOne({ username: req.params.username }).select(
      "username fullName profilePhotoUrl bannerUrl bio perfilPublico"
    );
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });
    const esYo = String(u._id) === String(req.userId);
    if (u.perfilPublico === false && !esYo) {
      return res.status(403).json({ error: "Este perfil es privado.", perfilPublico: false });
    }
    const [seguidores, siguiendo, posteos, sigo] = await Promise.all([
      Follow.countDocuments({ seguido: u._id }),
      Follow.countDocuments({ seguidor: u._id }),
      Post.countDocuments({ autor: u._id, group: null }),
      Follow.exists({ seguidor: req.userId, seguido: u._id }),
    ]);
    return res.json({
      ...pubUser(u),
      banner: u.bannerUrl || "",
      esYo,
      loSigo: !!sigo,
      stats: { seguidores, siguiendo, posteos },
    });
  } catch (err) {
    console.error("[community] getPerfil:", err.message);
    return res.status(500).json({ error: "No se pudo cargar el perfil." });
  }
};

// GET /api/community/buscar?q=... — descubrir usuarios públicos.
export const buscarUsuarios = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 40);
    if (q.length < 2) return res.json({ usuarios: [] });
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const users = await User.find({
      perfilPublico: { $ne: false },
      _id: { $ne: req.userId },
      $or: [{ username: rx }, { fullName: rx }],
    })
      .select("username fullName profilePhotoUrl bio")
      .limit(20);
    return res.json({ usuarios: users.map(pubUser) });
  } catch (err) {
    console.error("[community] buscarUsuarios:", err.message);
    return res.status(500).json({ error: "No se pudo buscar." });
  }
};

// ---------------- SEGUIR ----------------

// POST /api/community/follow/:userId
export const seguir = async (req, res) => {
  try {
    const { userId } = req.params;
    if (String(userId) === String(req.userId)) {
      return res.status(400).json({ error: "No podés seguirte a vos mismo." });
    }
    const existe = await User.exists({ _id: userId });
    if (!existe) return res.status(404).json({ error: "Usuario no encontrado" });
    await Follow.updateOne(
      { seguidor: req.userId, seguido: userId },
      { $setOnInsert: { seguidor: req.userId, seguido: userId } },
      { upsert: true }
    );
    return res.json({ loSigo: true });
  } catch (err) {
    console.error("[community] seguir:", err.message);
    return res.status(500).json({ error: "No se pudo seguir." });
  }
};

// DELETE /api/community/follow/:userId
export const dejarDeSeguir = async (req, res) => {
  try {
    await Follow.deleteOne({ seguidor: req.userId, seguido: req.params.userId });
    return res.json({ loSigo: false });
  } catch (err) {
    console.error("[community] dejarDeSeguir:", err.message);
    return res.status(500).json({ error: "No se pudo dejar de seguir." });
  }
};

const listaUsuarios = async (ids) => {
  const users = await User.find({ _id: { $in: ids } }).select("username fullName profilePhotoUrl bio");
  return users.map(pubUser);
};

// GET /api/community/users/:userId/followers
export const getSeguidores = async (req, res) => {
  try {
    const fs = await Follow.find({ seguido: req.params.userId }).select("seguidor").limit(200);
    return res.json({ usuarios: await listaUsuarios(fs.map((f) => f.seguidor)) });
  } catch (err) {
    console.error("[community] getSeguidores:", err.message);
    return res.status(500).json({ error: "No se pudo cargar." });
  }
};

// GET /api/community/users/:userId/following
export const getSiguiendo = async (req, res) => {
  try {
    const fs = await Follow.find({ seguidor: req.params.userId }).select("seguido").limit(200);
    return res.json({ usuarios: await listaUsuarios(fs.map((f) => f.seguido)) });
  } catch (err) {
    console.error("[community] getSiguiendo:", err.message);
    return res.status(500).json({ error: "No se pudo cargar." });
  }
};

// ---------------- POSTS / FEED ----------------

const limpiarActividad = (a) => {
  if (!a || typeof a !== "object") return undefined;
  return {
    tipo: ["caminata", "carrera", "bici"].includes(a.tipo) ? a.tipo : "caminata",
    metros: num(a.metros),
    secs: num(a.secs),
    kcal: num(a.kcal),
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(String(a.fecha || "")) ? a.fecha : undefined,
    ruta: Array.isArray(a.ruta)
      ? a.ruta
          .filter((p) => p && Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
          .slice(0, 500)
          .map((p) => ({ latitude: Number(p.latitude), longitude: Number(p.longitude) }))
      : undefined,
  };
};

const serializarPost = (p, meId, comentarios = 0) => ({
  id: p._id,
  tipo: p.tipo,
  texto: p.texto || "",
  foto: p.foto || "",
  actividad: p.actividad || null,
  group: p.group || null,
  kudos: (p.kudos || []).length,
  leDiKudos: (p.kudos || []).some((k) => String(k) === String(meId)),
  comentarios,
  createdAt: p.createdAt,
  autor: p.autor && p.autor.username ? pubUser(p.autor) : null,
});

const serializarComentario = (c) => ({
  id: c._id,
  texto: c.texto || "",
  createdAt: c.createdAt,
  autor: c.autor && c.autor.username ? pubUser(c.autor) : null,
});

// Cuenta comentarios por post → Map(postId → n).
const contarComentarios = async (ids) => {
  if (!ids.length) return new Map();
  const rows = await Comment.aggregate([
    { $match: { post: { $in: ids } } },
    { $group: { _id: "$post", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
};

// POST /api/community/posts — { tipo, texto, foto, actividad, group? }
export const crearPost = async (req, res) => {
  try {
    const { tipo, texto, foto, group } = req.body || {};
    const actividad = limpiarActividad(req.body.actividad);
    const t = tipo === "actividad" ? "actividad" : "texto";
    if (t === "texto" && !String(texto || "").trim() && !foto) {
      return res.status(400).json({ error: "El posteo está vacío." });
    }
    // Si es un posteo de club, tenés que ser miembro.
    let groupId = null;
    if (group) {
      const esMiembro = await GroupMember.exists({ group, user: req.userId });
      if (!esMiembro) return res.status(403).json({ error: "No sos miembro de este club." });
      groupId = group;
    }
    const post = await Post.create({
      autor: req.userId,
      group: groupId,
      tipo: t,
      texto: String(texto || "").slice(0, 600),
      foto: typeof foto === "string" ? foto.slice(0, 2000000) : "",
      actividad: t === "actividad" ? actividad : undefined,
    });
    const full = await Post.findById(post._id).populate("autor", "username fullName profilePhotoUrl bio");
    return res.json({ post: serializarPost(full, req.userId) });
  } catch (err) {
    console.error("[community] crearPost:", err.message);
    return res.status(500).json({ error: "No se pudo publicar." });
  }
};

// GET /api/community/grupos/:id/posts — posteos de un club.
export const getPostsDeGrupo = async (req, res) => {
  try {
    const posts = await Post.find({ group: req.params.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("autor", "username fullName profilePhotoUrl bio");
    const counts = await contarComentarios(posts.map((p) => p._id));
    return res.json({
      posts: posts.map((p) => serializarPost(p, req.userId, counts.get(String(p._id)) || 0)),
    });
  } catch (err) {
    console.error("[community] getPostsDeGrupo:", err.message);
    return res.status(500).json({ error: "No se pudieron cargar los posteos." });
  }
};

// GET /api/community/posts/:id/comentarios
export const getComentarios = async (req, res) => {
  try {
    const comentarios = await Comment.find({ post: req.params.id })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate("autor", "username fullName profilePhotoUrl bio");
    return res.json({ comentarios: comentarios.map(serializarComentario) });
  } catch (err) {
    console.error("[community] getComentarios:", err.message);
    return res.status(500).json({ error: "No se pudieron cargar los comentarios." });
  }
};

// POST /api/community/posts/:id/comentarios — { texto }
export const crearComentario = async (req, res) => {
  try {
    const texto = String(req.body?.texto || "").trim();
    if (!texto) return res.status(400).json({ error: "Escribí algo." });
    const post = await Post.findById(req.params.id).select("_id");
    if (!post) return res.status(404).json({ error: "Posteo no encontrado" });
    const c = await Comment.create({ post: post._id, autor: req.userId, texto: texto.slice(0, 600) });
    const full = await Comment.findById(c._id).populate("autor", "username fullName profilePhotoUrl bio");
    return res.json({ comentario: serializarComentario(full) });
  } catch (err) {
    console.error("[community] crearComentario:", err.message);
    return res.status(500).json({ error: "No se pudo comentar." });
  }
};

// DELETE /api/community/comentarios/:id — solo el autor del comentario.
export const borrarComentario = async (req, res) => {
  try {
    const c = await Comment.findById(req.params.id).select("autor");
    if (!c) return res.status(404).json({ error: "Comentario no encontrado" });
    if (String(c.autor) !== String(req.userId)) return res.status(403).json({ error: "No es tu comentario." });
    await Comment.deleteOne({ _id: c._id });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[community] borrarComentario:", err.message);
    return res.status(500).json({ error: "No se pudo borrar." });
  }
};

// GET /api/community/feed?before=<ISO>&limit=20 — posts de a quienes seguís + los tuyos.
export const getFeed = async (req, res) => {
  try {
    const fs = await Follow.find({ seguidor: req.userId }).select("seguido");
    const autores = fs.map((f) => f.seguido);
    autores.push(req.userId);
    const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 20));
    // Solo posteos generales (los de club quedan dentro del club, no en el feed).
    const filtro = { autor: { $in: autores }, group: null };
    if (req.query.before) {
      const d = new Date(req.query.before);
      if (!isNaN(d.getTime())) filtro.createdAt = { $lt: d };
    }
    const posts = await Post.find(filtro)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("autor", "username fullName profilePhotoUrl bio");
    const counts = await contarComentarios(posts.map((p) => p._id));
    return res.json({ posts: posts.map((p) => serializarPost(p, req.userId, counts.get(String(p._id)) || 0)) });
  } catch (err) {
    console.error("[community] getFeed:", err.message);
    return res.status(500).json({ error: "No se pudo cargar el feed." });
  }
};

// GET /api/community/users/:userId/posts
export const getPostsDeUsuario = async (req, res) => {
  try {
    // Solo posteos generales en el perfil (los de club viven en el club).
    const posts = await Post.find({ autor: req.params.userId, group: null })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("autor", "username fullName profilePhotoUrl bio");
    const counts = await contarComentarios(posts.map((p) => p._id));
    return res.json({ posts: posts.map((p) => serializarPost(p, req.userId, counts.get(String(p._id)) || 0)) });
  } catch (err) {
    console.error("[community] getPostsDeUsuario:", err.message);
    return res.status(500).json({ error: "No se pudo cargar." });
  }
};

// POST /api/community/posts/:id/kudos — toggle 👏
export const toggleKudos = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).select("kudos");
    if (!post) return res.status(404).json({ error: "Posteo no encontrado" });
    const yaDio = (post.kudos || []).some((k) => String(k) === String(req.userId));
    if (yaDio) {
      await Post.updateOne({ _id: post._id }, { $pull: { kudos: req.userId } });
    } else {
      await Post.updateOne({ _id: post._id }, { $addToSet: { kudos: req.userId } });
    }
    const n = yaDio ? post.kudos.length - 1 : post.kudos.length + 1;
    return res.json({ leDiKudos: !yaDio, kudos: Math.max(0, n) });
  } catch (err) {
    console.error("[community] toggleKudos:", err.message);
    return res.status(500).json({ error: "No se pudo dar kudos." });
  }
};

// DELETE /api/community/posts/:id — solo el autor.
export const borrarPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).select("autor");
    if (!post) return res.status(404).json({ error: "Posteo no encontrado" });
    if (String(post.autor) !== String(req.userId)) {
      return res.status(403).json({ error: "No es tu posteo." });
    }
    await Post.deleteOne({ _id: post._id });
    await Comment.deleteMany({ post: post._id });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[community] borrarPost:", err.message);
    return res.status(500).json({ error: "No se pudo borrar." });
  }
};
