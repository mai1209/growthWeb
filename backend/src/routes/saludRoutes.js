import express from "express";
import { getSalud, updateSalud } from "../controllers/saludController.js";
import { requireAuth } from "../middlewares/authJwt.js";

const router = express.Router();

router.get("/", requireAuth, getSalud);
router.put("/", requireAuth, updateSalud);

export default router;
