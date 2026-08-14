// En /backend/src/routes/taskRoutes.js

import express from 'express';
import {
  createHabito,
  getTasks,
  updateTaskStatus,
  deleteTask,
  updateTask,
  buscarUsuarioTarea,
  compartirTarea,
  getInvitacionesTarea,
  aceptarInvitacionTarea,
  salirDeTarea,
  quitarColaborador,
} from '../controllers/taskController.js';
import { requireAuth } from '../middlewares/authJwt.js';

const router = express.Router();

router.post('/', requireAuth, createHabito);
router.get('/', requireAuth, getTasks);

// --- 👥 Compartir tareas (rutas específicas ANTES de las de /:id) ---
router.get('/buscar-usuario', requireAuth, buscarUsuarioTarea);
router.get('/invitaciones', requireAuth, getInvitacionesTarea);
router.post('/:id/compartir', requireAuth, compartirTarea);
router.post('/:id/aceptar', requireAuth, aceptarInvitacionTarea);
router.post('/:id/salir', requireAuth, salirDeTarea);
router.delete('/:id/colaborador/:userId', requireAuth, quitarColaborador);

router.delete('/:id', requireAuth, deleteTask);

// Ruta específica para actualizar SÓLO el estado de "completada"
router.put('/:id/status', requireAuth, updateTaskStatus);

// Ruta para actualizar TODA la información de la tarea
router.put('/:id', requireAuth, updateTask);

export default router;
