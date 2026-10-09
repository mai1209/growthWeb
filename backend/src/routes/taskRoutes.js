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
  subirImagenNota,
  getPrioridades,
  savePrioridades,
  getEtiquetasNotas,
  saveEtiquetasNotas,
  deleteAllTasks,
} from '../controllers/taskController.js';
import { requireAuth } from '../middlewares/authJwt.js';

const router = express.Router();

router.post('/', requireAuth, createHabito);
// 🖼️ Imagen de una nota → Vercel Blob (devuelve { url })
router.post('/imagen', requireAuth, subirImagenNota);
router.get('/', requireAuth, getTasks);

// 🎨 Prioridades personalizadas (nombre + color) del usuario
router.get('/prioridades', requireAuth, getPrioridades);
router.put('/prioridades', requireAuth, savePrioridades);
// 🏷️ Etiquetas de notas (nombre + color) del usuario
router.get('/etiquetas-notas', requireAuth, getEtiquetasNotas);
router.put('/etiquetas-notas', requireAuth, saveEtiquetasNotas);

// 🧹 Borrar todas las tareas del usuario (antes de las rutas /:id)
router.delete('/all', requireAuth, deleteAllTasks);

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
