import express from "express";
import { getSalud, updateSalud, getRecorridos } from "../controllers/saludController.js";
import { requireAuth } from "../middlewares/authJwt.js";

const router = express.Router();

router.get("/", requireAuth, getSalud);
router.get("/recorridos", requireAuth, getRecorridos);
router.put("/", requireAuth, updateSalud);

export default router;
