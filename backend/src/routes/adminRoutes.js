import express from 'express';
import { requireAuth } from '../middlewares/authJwt.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { getOverview, getHealth, getSecurity } from '../controllers/adminController.js';
import { getAppUpdate, updateAppUpdate } from '../controllers/appUpdateController.js';

const router = express.Router();

// Todo el panel de monitoreo exige login + email en ADMIN_EMAILS
router.use(requireAuth, requireAdmin);

router.get('/overview', getOverview);
router.get('/health', getHealth);
router.get('/security', getSecurity);

// Aviso de actualización de la app (popup al abrir)
router.get('/app-update', getAppUpdate);
router.put('/app-update', updateAppUpdate);

export default router;
