import express from 'express';
import { 
  createIncomeEgress, 
  getIncomeEgress, 
  getIncomeEgressById, 
  updateIncomeEgress, 
  deleteIncomeEgress 
} from '../controllers/ingresoEgresoController.js';
import { requireAuth } from '../middlewares/authJwt.js';

const router = express.Router();

// 🔥 TODAS las rutas requieren autenticación
router.post('/', requireAuth, createIncomeEgress);
router.get('/', requireAuth, getIncomeEgress);
router.get('/:id', requireAuth, getIncomeEgressById);
router.put('/:id', requireAuth, updateIncomeEgress);
router.delete('/:id', requireAuth, deleteIncomeEgress);

export default router;