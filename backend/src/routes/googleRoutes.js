import express from "express";
import {
  disconnect,
  getAuthUrl,
  getStatus,
  handleCallback,
  syncFromGoogle,
} from "../controllers/googleController.js";
import { requireAuth } from "../middlewares/authJwt.js";

const router = express.Router();

router.get("/status", requireAuth, getStatus);
router.get("/auth", requireAuth, getAuthUrl);
// El callback lo invoca Google (redirect del navegador): no lleva token, va sin requireAuth.
router.get("/callback", handleCallback);
router.post("/sync", requireAuth, syncFromGoogle);
router.post("/disconnect", requireAuth, disconnect);

export default router;
