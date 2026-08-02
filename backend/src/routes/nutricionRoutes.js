import express from "express";
import { analizarFoto } from "../controllers/nutricionController.js";
import { requireAuth } from "../middlewares/authJwt.js";

const router = express.Router();

router.post("/analizar-foto", requireAuth, analizarFoto);

export default router;
