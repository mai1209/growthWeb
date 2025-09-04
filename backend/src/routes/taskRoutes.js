// routes/habitoRoutes.js

import express from 'express';
// Importamos la función nombrada entre llaves {} y con la extensión .js
import { createHabito , getTasks, updateTaskStatus, deleteTask} from '../controllers/taskController.js';
// Asumimos que tu middleware también está en formato ESM
import{ requireAuth} from '../middlewares/authJwt.js'; 

const router = express.Router();

// La sintaxis de la ruta no cambia
router.post('/', requireAuth, createHabito);
// --- AÑADE ESTA NUEVA RUTA ---
// Responde a: GET /api/task
router.get('/', requireAuth, getTasks);

// --- AÑADE ESTA NUEVA RUTA ---
// Responderá a peticiones PUT a /api/task/un_id_de_tarea
router.put('/:id', requireAuth, updateTaskStatus);


router.delete('/:id', requireAuth, deleteTask); // La nueva ruta para borrar

// Cambiamos module.exports por export default
export default router;