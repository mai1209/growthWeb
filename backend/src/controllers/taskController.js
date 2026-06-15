import Task from "../models/taskModel.js";
import mongoose from "mongoose";
import { syncTaskToGoogle, deleteTaskFromGoogle } from "../utils/googleCalendar.js";

const normalizeWorkspaceValue = (value) => {
  const workspace = String(value || "").trim();
  return /^business(?::[a-f\d]{24})?$/i.test(workspace) ? workspace : "personal";
};

const normalizeWorkspace = (req) =>
  normalizeWorkspaceValue(req.query.workspace || req.body.workspace || req.headers["x-workspace"]);

const buildWorkspaceQuery = (workspace) =>
  workspace !== "personal"
    ? { workspace }
    : { $or: [{ workspace: "personal" }, { workspace: { $exists: false } }] };

const normalizeTaskDate = (value) => {
  if (!value) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
  }

  if (typeof value === "string") {
    const matched = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (matched) {
      const [, year, month, day] = matched;
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
    }
  }

  const rawDate = new Date(value);

  if (Number.isNaN(rawDate.getTime())) {
    return new Date();
  }

  return new Date(
    Date.UTC(
      rawDate.getUTCFullYear(),
      rawDate.getUTCMonth(),
      rawDate.getUTCDate(),
      12
    )
  );
};

const serializeTask = (task) => {
  const raw = typeof task.toObject === "function" ? task.toObject() : task;

  return {
    ...raw,
    fecha: normalizeTaskDate(raw.fecha),
  };
};

export const createHabito = async (req, res) => {
  try {
    const {
      meta,
      tipo,
      contenido,
      fecha,
      horario,
      urgencia,
      color,
      esRecurrente,
      diasRepeticion,
      carpeta,
      flashcards,
    } = req.body;
    const userId = req.user.id;
    const workspace = normalizeWorkspace(req);

    // AÑADE ESTE CONSOLE.LOG
    console.log(
      `[POST /api/task] Creando tarea para el ID de usuario: ${userId}`
    );

    const nuevoHabito = new Task({
      user: userId,
      workspace,
      meta,
      tipo: tipo === "note" ? "note" : "task",
      contenido,
      fecha: normalizeTaskDate(fecha),
      horario,
      urgencia,
      color,
      esRecurrente,
      diasRepeticion: esRecurrente ? diasRepeticion : [],
      carpeta: typeof carpeta === "string" ? carpeta.trim() : "",
      flashcards: Array.isArray(flashcards) ? flashcards : [],
    });
    const habitoGuardado = await nuevoHabito.save();

    // 🔗 Sincroniza con Google Calendar (si falla, la tarea igual queda guardada)
    const googleEventId = await syncTaskToGoogle(userId, habitoGuardado);
    if (googleEventId) {
      habitoGuardado.googleEventId = googleEventId;
    }

    res.status(201).json(serializeTask(habitoGuardado));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear el hábito" });
  }
};

// --- MODIFICA ESTA FUNCIÓN ---
export const getTasks = async (req, res) => {
  try {
    const { fecha, tipo } = req.query;
    const userId = req.user.id;
    const workspace = normalizeWorkspace(req);
    const workspaceQuery = buildWorkspaceQuery(workspace);
    const typeQuery =
      tipo === "note" ? { tipo: "note" } : { $or: [{ tipo: "task" }, { tipo: { $exists: false } }] };

    const buildTaskState = (task, targetDate) => {
      const taskObj = serializeTask(task);
      taskObj.completada = task.completadasEn?.includes(targetDate) || false;
      return taskObj;
    };

    // 👇 SI NO HAY FECHA, SALIMOS ANTES
    if (!fecha) {
      const allTasks = await Task.find({
        user: new mongoose.Types.ObjectId(userId),
        ...workspaceQuery,
        ...typeQuery,
      }).sort({ fecha: 1, horario: 1 });

      const allTasksWithState = allTasks.map((task) =>
        buildTaskState(task, normalizeTaskDate(task.fecha).toISOString().slice(0, 10))
      );

      return res.status(200).json(allTasksWithState);
    }

    // ✅ PRIMERO crear las fechas
    const startDate = new Date(fecha);
    startDate.setUTCHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);


    const diasMap = ["D", "L", "M", "MI", "J", "V", "S"];
const diaActual = diasMap[startDate.getUTCDay()];


    // ✅ DESPUÉS usarlas
    const query = {
      user: new mongoose.Types.ObjectId(userId),
      $and: [
        workspaceQuery,
        typeQuery,
        {
          $or: [
            {
              esRecurrente: false,
              fecha: {
                $gte: startDate,
                $lt: endDate,
              },
            },
            {
              esRecurrente: true,
              fecha: { $lt: endDate },
              diasRepeticion: diaActual,
            },
          ],
        },
      ],
    };

 const tasks = await Task.find(query).sort({ horario: 1 });

// 👇 FECHA STRING (YYYY-MM-DD)
const fechaStr = startDate.toISOString().slice(0, 10);

// 👇 INYECTAMOS "completada" SEGÚN completadasEn
const tasksConEstado = tasks.map((task) => buildTaskState(task, fechaStr));

res.status(200).json(tasksConEstado);


  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error en el servidor" });
  }
};


// --- AÑADE ESTA NUEVA FUNCIÓN ---
// @desc    Actualizar el estado de una tarea (completada/pendiente)
// @route   PUT /api/task/:id
// @access  Private
export const updateTaskStatus = async (req, res) => {
  try {
    const { fecha } = req.body; // "YYYY-MM-DD"
    const workspace = normalizeWorkspace(req);

    const task = await Task.findOne({ _id: req.params.id, ...buildWorkspaceQuery(workspace) });
    if (!task) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    if (task.user.toString() !== req.user.id) {
      return res.status(401).json({ message: "Usuario no autorizado" });
    }

    // 🔁 Toggle en completadasEn
    const index = task.completadasEn.indexOf(fecha);

    if (index === -1) {
      task.completadasEn.push(fecha);
    } else {
      task.completadasEn.splice(index, 1);
    }

    await task.save();

    // ✅ CALCULAR completada PARA ESA FECHA
    const completada = task.completadasEn.includes(fecha);

    const taskObj = serializeTask(task);
    taskObj.completada = completada;

    // 👈 ESTO ES LO CLAVE
    res.status(200).json(taskObj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar estado" });
  }
};



// --- AÑADE ESTA NUEVA FUNCIÓN ---
// @desc    Borrar una tarea
// @route   DELETE /api/task/:id
// @access  Private
export const deleteTask = async (req, res) => {
  try {
    const workspace = normalizeWorkspace(req);
    // 1. Buscamos la tarea por su ID, que viene en la URL (req.params.id)
    const task = await Task.findOne({ _id: req.params.id, ...buildWorkspaceQuery(workspace) });

    // Si no se encuentra, devolvemos un error 404
    if (!task) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    // 2. Verificación de seguridad: nos aseguramos de que el usuario que la quiere borrar sea el dueño
    if (task.user.toString() !== req.user.id) {
      return res.status(401).json({ message: "Usuario no autorizado" });
    }

    // 🔗 Borramos también el evento vinculado en Google Calendar (si existe)
    await deleteTaskFromGoogle(req.user.id, task);

    // 3. Si todo está bien, eliminamos la tarea de la base de datos
    await Task.findByIdAndDelete(req.params.id);

    // 4. Enviamos una respuesta de éxito
    res
      .status(200)
      .json({ message: "Tarea eliminada correctamente", id: req.params.id });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error en el servidor al eliminar la tarea" });
  }
};

// En /backend/src/controllers/taskController.js

// ... (tus otras funciones como createHabito, getTasks, etc.)

export const updateTask = async (req, res) => {
  try {
    const activeWorkspace = normalizeWorkspace(req);
    // 1. Buscamos la tarea por su ID
    const task = await Task.findOne({ _id: req.params.id, ...buildWorkspaceQuery(activeWorkspace) });

    if (!task) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    // 2. Verificamos que el usuario sea el dueño
    if (task.user.toString() !== req.user.id) {
      return res.status(401).json({ message: "Usuario no autorizado" });
    }

    // (Opcional pero recomendado) Imprime en la consola de Render qué datos llegan
    console.log("Datos recibidos para actualizar:", req.body);

    // 3. Extraemos los campos que SÍ queremos permitir que se actualicen
    const {
      meta,
      tipo,
      contenido,
      fecha,
      horario,
      urgencia,
      color,
      esRecurrente,
      diasRepeticion,
      completada,
      workspace,
      carpeta,
      flashcards,
    } =
      req.body;

    // 4. Actualizamos el documento que encontramos en la base de datos
    task.meta = meta || task.meta;
    if (tipo !== undefined) task.tipo = tipo === "note" ? "note" : "task";
    if (workspace !== undefined) task.workspace = normalizeWorkspaceValue(workspace);
    if (contenido !== undefined) task.contenido = contenido;
    task.fecha = fecha ? normalizeTaskDate(fecha) : task.fecha;
    task.horario = horario || task.horario;
    task.urgencia = urgencia || task.urgencia;
    task.color = color || task.color;
    // Para los booleanos, necesitamos una comprobación explícita
    if (esRecurrente !== undefined) task.esRecurrente = esRecurrente;
    if (diasRepeticion !== undefined) {
      task.diasRepeticion = task.esRecurrente ? diasRepeticion : [];
    }
    if (completada !== undefined) task.completada = completada;
    if (carpeta !== undefined) task.carpeta = typeof carpeta === "string" ? carpeta.trim() : "";
    if (flashcards !== undefined) task.flashcards = Array.isArray(flashcards) ? flashcards : [];

    // 5. Guardamos el documento actualizado (esto SIEMPRE ejecuta las validaciones del modelo)
    const updatedTask = await task.save();

    // 🔗 Sincroniza el cambio con Google Calendar (crea o actualiza el evento)
    const googleEventId = await syncTaskToGoogle(req.user.id, updatedTask);
    if (googleEventId) {
      updatedTask.googleEventId = googleEventId;
    }

    res.status(200).json(serializeTask(updatedTask));
  } catch (error) {
    console.error("Error al actualizar la tarea:", error);
    res
      .status(500)
      .json({ message: "Error en el servidor al actualizar la tarea" });
  }
};
