// En /backend/src/routes/taskRoutes.js (CORREGIDO)

import express from 'express';
import { createHabito, getTasks, updateTaskStatus, deleteTask, updateTask } from '../controllers/taskController.js';
import { requireAuth } from '../middlewares/authJwt.js'; 

const router = express.Router();

router.post('/', requireAuth, createHabito);
router.get('/', requireAuth, getTasks);
router.delete('/:id', requireAuth, deleteTask);

// --- CORRECCIÓN AQUÍ ---
// Ruta específica para actualizar SÓLO el estado de "completada"
router.put('/:id/status', requireAuth, updateTaskStatus);

// Ruta para actualizar TODA la información de la tarea
router.put('/:id', requireAuth, updateTask);

export default router;