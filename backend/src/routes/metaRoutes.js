import express from "express";
import { getMetas, createMeta, updateMeta, deleteMeta } from "../controllers/metaController.js";
import { requireAuth } from "../middlewares/authJwt.js";

const router = express.Router();

router.get("/", requireAuth, getMetas);
router.post("/", requireAuth, createMeta);
router.put("/:id", requireAuth, updateMeta);
router.delete("/:id", requireAuth, deleteMeta);

export default router;
