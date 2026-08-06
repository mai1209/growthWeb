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

export default router;
