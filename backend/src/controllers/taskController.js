import Task from "../models/taskModel.js";
import mongoose from "mongoose";

export const createHabito = async (req, res) => {
  try {
    const {
      meta,
      fecha,
      horario,
      urgencia,
      color,
      esRecurrente,
      diasRepeticion,
    } = req.body;
    const userId = req.user.id;

    // AÑADE ESTE CONSOLE.LOG
    console.log(
      `[POST /api/task] Creando tarea para el ID de usuario: ${userId}`
    );

    const nuevoHabito = new Task({
      user: userId,
      meta,
      fecha,
      horario,
      urgencia,
      color,
      esRecurrente,
      diasRepeticion: esRecurrente ? diasRepeticion : [],
    });
    const habitoGuardado = await nuevoHabito.save();
    res.status(201).json(habitoGuardado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear el hábito" });
  }
};

// --- MODIFICA ESTA FUNCIÓN ---
export const getTasks = async (req, res) => {
  try {
    const { fecha } = req.query;
    const userId = req.user.id;

    // 👇 SI NO HAY FECHA, SALIMOS ANTES
    if (!fecha) {
      const allTasks = await Task.find({
        user: new mongoose.Types.ObjectId(userId),
      }).sort({ fecha: 1, horario: 1 });

      return res.status(200).json(allTasks);
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
    };

 const tasks = await Task.find(query).sort({ horario: 1 });

// 👇 FECHA STRING (YYYY-MM-DD)
const fechaStr = startDate.toISOString().slice(0, 10);

// 👇 INYECTAMOS "completada" SEGÚN completadasEn
const tasksConEstado = tasks.map((task) => {
  const taskObj = task.toObject();
  taskObj.completada = task.completadasEn?.includes(fechaStr);
  return taskObj;
});

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

    const task = await Task.findById(req.params.id);
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

    const taskObj = task.toObject();
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
    // 1. Buscamos la tarea por su ID, que viene en la URL (req.params.id)
    const task = await Task.findById(req.params.id);

    // Si no se encuentra, devolvemos un error 404
    if (!task) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    // 2. Verificación de seguridad: nos aseguramos de que el usuario que la quiere borrar sea el dueño
    if (task.user.toString() !== req.user.id) {
      return res.status(401).json({ message: "Usuario no autorizado" });
    }

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
    // 1. Buscamos la tarea por su ID
    const task = await Task.findById(req.params.id);

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
    const { meta, fecha, horario, urgencia, color, esRecurrente, completada } =
      req.body;

    // 4. Actualizamos el documento que encontramos en la base de datos
    task.meta = meta || task.meta;
    task.fecha = fecha || task.fecha;
    task.horario = horario || task.horario;
    task.urgencia = urgencia || task.urgencia;
    task.color = color || task.color;
    // Para los booleanos, necesitamos una comprobación explícita
    if (esRecurrente !== undefined) task.esRecurrente = esRecurrente;
    if (completada !== undefined) task.completada = completada;

    // 5. Guardamos el documento actualizado (esto SIEMPRE ejecuta las validaciones del modelo)
    const updatedTask = await task.save();

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error("Error al actualizar la tarea:", error);
    res
      .status(500)
      .json({ message: "Error en el servidor al actualizar la tarea" });
  }
};
