import express from "express";
import {
  getFiscalConfig,
  updateFiscalConfig,
} from "../controllers/fiscalConfigController.js";
import { requireAuth } from "../middlewares/authJwt.js";

const router = express.Router();

router.get("/", requireAuth, getFiscalConfig);
router.put("/", requireAuth, updateFiscalConfig);

export default router;
