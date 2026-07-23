import express from "express";
import { getJournal, saveJournal, savePreguntas } from "../controllers/journalController.js";
import { requireAuth } from "../middlewares/authJwt.js";

const router = express.Router();

router.get("/", requireAuth, getJournal);
router.put("/", requireAuth, saveJournal);
router.put("/preguntas", requireAuth, savePreguntas);

export default router;
