import express from "express";
import { getGym, updateGym } from "../controllers/gymController.js";
import { requireAuth } from "../middlewares/authJwt.js";

const router = express.Router();

router.get("/", requireAuth, getGym);
router.put("/", requireAuth, updateGym);

export default router;
