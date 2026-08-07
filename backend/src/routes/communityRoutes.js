import express from "express";
import { requireAuth } from "../middlewares/authJwt.js";
import {
  getMiPerfil,
  updateMiPerfil,
  getPerfil,
  buscarUsuarios,
  seguir,
  dejarDeSeguir,
  getSeguidores,
  getSiguiendo,
  crearPost,
  getFeed,
  getPostsDeUsuario,
  toggleKudos,
  borrarPost,
} from "../controllers/communityController.js";
import {
  crearGrupo,
  descubrirGrupos,
  misGrupos,
  getGrupo,
  unirse,
  salir,
  miembrosGrupo,
  editarGrupo,
  borrarGrupo,
} from "../controllers/groupController.js";
import {
  crearReto,
  descubrirRetos,
  misRetos,
  getReto,
  unirseReto,
  salirReto,
  rankingReto,
  editarReto,
  borrarReto,
} from "../controllers/challengeController.js";

const router = express.Router();

router.get("/me", requireAuth, getMiPerfil);
router.put("/me", requireAuth, updateMiPerfil);
router.get("/buscar", requireAuth, buscarUsuarios);
router.get("/feed", requireAuth, getFeed);

router.post("/posts", requireAuth, crearPost);
router.post("/posts/:id/kudos", requireAuth, toggleKudos);
router.delete("/posts/:id", requireAuth, borrarPost);

router.post("/follow/:userId", requireAuth, seguir);
router.delete("/follow/:userId", requireAuth, dejarDeSeguir);

router.get("/users/:userId/followers", requireAuth, getSeguidores);
router.get("/users/:userId/following", requireAuth, getSiguiendo);
router.get("/users/:userId/posts", requireAuth, getPostsDeUsuario);
router.get("/users/:username", requireAuth, getPerfil);

// Clubes / grupos (Fase 3). Orden: rutas fijas antes que /:id.
router.post("/grupos", requireAuth, crearGrupo);
router.get("/grupos", requireAuth, descubrirGrupos);
router.get("/grupos/mios", requireAuth, misGrupos);
router.get("/grupos/:id/miembros", requireAuth, miembrosGrupo);
router.post("/grupos/:id/join", requireAuth, unirse);
router.delete("/grupos/:id/join", requireAuth, salir);
router.get("/grupos/:id", requireAuth, getGrupo);
router.put("/grupos/:id", requireAuth, editarGrupo);
router.delete("/grupos/:id", requireAuth, borrarGrupo);

// Retos / desafíos (Fase 3). Orden: rutas fijas antes que /:id.
router.post("/retos", requireAuth, crearReto);
router.get("/retos", requireAuth, descubrirRetos);
router.get("/retos/mios", requireAuth, misRetos);
router.get("/retos/:id/ranking", requireAuth, rankingReto);
router.post("/retos/:id/join", requireAuth, unirseReto);
router.delete("/retos/:id/join", requireAuth, salirReto);
router.get("/retos/:id", requireAuth, getReto);
router.put("/retos/:id", requireAuth, editarReto);
router.delete("/retos/:id", requireAuth, borrarReto);

export default router;
