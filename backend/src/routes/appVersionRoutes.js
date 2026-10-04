import express from "express";
import { getPublicAppVersion } from "../controllers/appUpdateController.js";

const router = express.Router();

// Info de versión para el aviso de "actualizá la app". Ya no está fija en el
// código: se edita desde /monitoreo (versión publicada, mensaje, novedades y
// si es obligatorio) y se guarda en la base — ver appUpdateController.
// GET /api/app-version  (público)
router.get("/", getPublicAppVersion);

export default router;
