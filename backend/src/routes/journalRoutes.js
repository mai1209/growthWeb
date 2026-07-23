import express from "express";
import { getJournal, saveJournal } from "../controllers/journalController.js";
import { requireAuth } from "../middlewares/authJwt.js";

const router = express.Router();

router.get("/", requireAuth, getJournal);
router.put("/", requireAuth, saveJournal);

export default router;
