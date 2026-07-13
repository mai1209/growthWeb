import express from "express";
import {
  createIncomeEgress,
  getIncomeEgress,
  getIncomeEgressById,
  updateIncomeEgress,
  deleteIncomeEgress,
  getAllIncomeEgress,
  settleDebtMovement,
  emitirFacturaMovimiento,
} from "../controllers/ingresoEgresoController.js";
import { requireAuth } from "../middlewares/authJwt.js";

const router = express.Router();

// Crear movimiento
// POST /api/add
router.post("/", requireAuth, createIncomeEgress);

// Obtener movimientos
// GET /api/add
router.get("/", requireAuth, getIncomeEgress);

// Obtener todos los movimientos
// GET /api/add/all
router.get("/all", requireAuth, getAllIncomeEgress);

// Marcar deuda como pagada
// POST /api/add/:id/settle-debt
router.post("/:id/settle-debt", requireAuth, settleDebtMovement);

// Emitir factura electrónica (ARCA) para un ingreso
// POST /api/add/:id/factura
router.post("/:id/factura", requireAuth, emitirFacturaMovimiento);

// Obtener movimiento por ID
// GET /api/add/:id
router.get("/:id", requireAuth, getIncomeEgressById);

// Actualizar movimiento
// PUT /api/add/:id
router.put("/:id", requireAuth, updateIncomeEgress);

// Eliminar movimiento
// DELETE /api/add/:id
router.delete("/:id", requireAuth, deleteIncomeEgress);

export default router;