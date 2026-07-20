import express from "express";
import {
  getAfirmaciones,
  updateAfirmaciones,
  marcarLeido,
  desmarcarLeido,
} from "../controllers/afirmacionController.js";
import { requireAuth } from "../middlewares/authJwt.js";

const router = express.Router();

router.get("/", requireAuth, getAfirmaciones);
router.put("/", requireAuth, updateAfirmaciones);
router.post("/leer", requireAuth, marcarLeido);
router.delete("/leer", requireAuth, desmarcarLeido);

export default router;
