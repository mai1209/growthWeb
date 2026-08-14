import Task from "../models/taskModel.js";
import Meta from "../models/metaModel.js";
import User from "../models/userModel.js";
import mongoose from "mongoose";

// Datos públicos mínimos de un usuario (para dueño/colaboradores de una tarea).
const pubUser = (u) =>
  u && typeof u === "object" && u._id
    ? {
        id: String(u._id),
        username: u.username || "",
        fullName: u.fullName || "",
        foto: u.profilePhotoUrl || "",
      }
    : null;

const POPULATE_COLABS = [
  { path: "user", select: "username fullName profilePhotoUrl" },
  { path: "colaboradores.user", select: "username fullName profilePhotoUrl" },
];

// Condición de "puedo ver esta tarea": es mía, o soy colaborador aceptado.
// Las tareas compartidas se muestran solo en el workspace personal.
const ownershipCond = (userId, workspace, workspaceQuery) => {
  const oid = new mongoose.Types.ObjectId(userId);
  const mine = { user: oid, ...workspaceQuery };
  if (workspace !== "personal") return mine;
  const shared = {
    colaboradores: { $elemMatch: { user: oid, estado: "aceptado" } },
  };
  return { $or: [mine, shared] };
};

const puedeEditarTarea = (task, userId) => {
  if (String(task.user?._id || task.user) === String(userId)) return true;
  return (task.colaboradores || []).some(
    (c) => String(c.user?._id || c.user) === String(userId) && c.estado === "aceptado"
  );
};

// Carga perezosa de la sincronización con Google. Si el módulo (o sus paquetes)
// no se puede cargar en el entorno serverless, NO rompe el resto de la API.
let googleSyncModule;
const loadGoogleSync = async () => {
  if (googleSyncModule !== undefined) return googleSyncModule;
  try {
    googleSyncModule = await import("../utils/googleCalendar.js");
  } catch (error) {
    console.warn("googleCalendar no disponible:", error.message);
    googleSyncModule = null;
  }
  return googleSyncModule;
};

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

const TIPOS_VALIDOS = ["task", "note", "shopping"];
const normalizeTipo = (value) => (TIPOS_VALIDOS.includes(value) ? value : "task");

const normalizeItems = (value) =>
  Array.isArray(value)
    ? value.map((it, index) => {
        // Precio unitario opcional (null si no tiene) y cantidad (>=1). Se
        // preservan para que la lista de compras no pierda los precios al guardar.
        const precioNum =
          it?.precio == null || it.precio === "" ? null : Number(it.precio);
        const precio = Number.isFinite(precioNum) ? precioNum : null;
        const cantidadNum = Number(it?.cantidad);
        const cantidad =
          Number.isFinite(cantidadNum) && cantidadNum > 0 ? cantidadNum : 1;
        return {
          id: String(it?.id ?? index),
          text: typeof it?.text === "string" ? it.text : "",
          done: Boolean(it?.done),
          precio,
          cantidad,
        };
      })
    : [];

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

const serializeTask = (task, meId) => {
  const raw = typeof task.toObject === "function" ? task.toObject() : task;
  const ownerId = raw.user && raw.user._id ? String(raw.user._id) : String(raw.user || "");
  const colabs = (raw.colaboradores || [])
    .map((c) => {
      const info = pubUser(c.user);
      return info ? { ...info, estado: c.estado } : { id: String(c.user), estado: c.estado };
    })
    .filter((c) => c.id);

  return {
    ...raw,
    user: ownerId, // se mantiene como id (string) por compatibilidad con el front
    fecha: normalizeTaskDate(raw.fecha),
    owner: pubUser(raw.user) || { id: ownerId },
    colaboradores: colabs,
    compartida: colabs.length > 0,
    soyOwner: meId ? String(ownerId) === String(meId) : undefined,
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
      items,
      metaId,
      hitoIndex,
    } = req.body;
    const userId = req.user.id;
    const workspace = normalizeWorkspace(req);
    const tipoFinal = normalizeTipo(tipo);
    const idxHito = Number.isInteger(hitoIndex) ? hitoIndex : -1;

    // AÑADE ESTE CONSOLE.LOG
    console.log(
      `[POST /api/task] Creando tarea para el ID de usuario: ${userId}`
    );

    const nuevoHabito = new Task({
      user: userId,
      workspace,
      meta,
      tipo: tipoFinal,
      contenido,
      fecha: normalizeTaskDate(fecha),
      horario,
      urgencia,
      color,
      esRecurrente,
      diasRepeticion: esRecurrente ? diasRepeticion : [],
      carpeta: typeof carpeta === "string" ? carpeta.trim() : "",
      flashcards: Array.isArray(flashcards) ? flashcards : [],
      items: tipoFinal === "shopping" ? normalizeItems(items) : [],
      metaId: typeof metaId === "string" ? metaId : "",
      hitoIndex: idxHito,
    });
    const habitoGuardado = await nuevoHabito.save();

    // 🎯 Si la tarea nació de un hito, dejamos el id de la tarea en ese hito
    // (para poder sincronizar el "hecho" en ambos sentidos).
    if (metaId && idxHito >= 0) {
      try {
        const meta = await Meta.findOne({ _id: metaId, usuario: userId });
        if (meta && meta.hitos && meta.hitos[idxHito]) {
          meta.hitos[idxHito].taskId = String(habitoGuardado._id);
          await meta.save();
        }
      } catch (e) {
        /* si falla el link, la tarea igual queda creada */
      }
    }

    // 🔗 Sincroniza con Google Calendar (si falla, la tarea igual queda guardada).
    // Las listas de compras no van al calendario.
    const g = tipoFinal === "shopping" ? null : await loadGoogleSync();
    const googleEventId = g ? await g.syncTaskToGoogle(userId, habitoGuardado) : null;
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
      tipo === "note"
        ? { tipo: "note" }
        : tipo === "shopping"
        ? { tipo: "shopping" }
        : { $or: [{ tipo: "task" }, { tipo: { $exists: false } }] };

    const buildTaskState = (task, targetDate) => {
      const taskObj = serializeTask(task, userId);
      taskObj.completada = task.completadasEn?.includes(targetDate) || false;
      return taskObj;
    };

    // 👇 SI NO HAY FECHA, SALIMOS ANTES
    if (!fecha) {
      const allTasks = await Task.find({
        $and: [ownershipCond(userId, workspace, workspaceQuery), typeQuery],
      })
        .populate(POPULATE_COLABS)
        .sort({ fecha: 1, horario: 1 });

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
      $and: [
        ownershipCond(userId, workspace, workspaceQuery),
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

 const tasks = await Task.find(query).populate(POPULATE_COLABS).sort({ horario: 1 });

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

    // Buscamos por id (sin filtrar workspace): una tarea compartida vive en el
    // workspace del dueño, pero el colaborador la completa desde el suyo.
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    if (!puedeEditarTarea(task, req.user.id)) {
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

    // 🎯 Si la tarea está vinculada a un hito, sincronizamos el "hecho".
    if (task.metaId && task.hitoIndex >= 0) {
      try {
        const meta = await Meta.findOne({ _id: task.metaId, usuario: req.user.id });
        if (meta && meta.hitos && meta.hitos[task.hitoIndex]) {
          const hechoActual = task.completadasEn.length > 0;
          if (meta.hitos[task.hitoIndex].hecho !== hechoActual) {
            meta.hitos[task.hitoIndex].hecho = hechoActual;
            await meta.save();
          }
        }
      } catch (e) {
        /* si falla el sync, el estado de la tarea igual se guardó */
      }
    }

    await task.populate(POPULATE_COLABS);
    const taskObj = serializeTask(task, req.user.id);
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

    // 2. Si NO es el dueño pero es colaborador, "borrar" = salir de la tarea
    // compartida (se quita a sí mismo, la tarea sigue viva para los demás).
    if (task.user.toString() !== req.user.id) {
      const esColab = (task.colaboradores || []).some(
        (c) => c.user.toString() === req.user.id
      );
      if (!esColab) {
        return res.status(401).json({ message: "Usuario no autorizado" });
      }
      task.colaboradores = task.colaboradores.filter(
        (c) => c.user.toString() !== req.user.id
      );
      await task.save();
      return res
        .status(200)
        .json({ message: "Saliste de la tarea compartida", id: req.params.id, salida: true });
    }

    // 🔗 Borramos también el evento vinculado en Google Calendar (si existe)
    const g = await loadGoogleSync();
    if (g) await g.deleteTaskFromGoogle(req.user.id, task);

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
    // 1. Buscamos la tarea por su ID (una tarea compartida puede editarla
    // cualquier colaborador aceptado, aunque el dueño la tenga en otro workspace).
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    // 2. Verificamos que el usuario sea el dueño o colaborador aceptado
    if (!puedeEditarTarea(task, req.user.id)) {
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
      items,
    } =
      req.body;

    // 4. Actualizamos el documento que encontramos en la base de datos
    task.meta = meta || task.meta;
    if (tipo !== undefined) task.tipo = normalizeTipo(tipo);
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
    if (items !== undefined) task.items = normalizeItems(items);

    // 5. Guardamos el documento actualizado (esto SIEMPRE ejecuta las validaciones del modelo)
    const updatedTask = await task.save();

    // 🔗 Sincroniza el cambio con Google Calendar (crea o actualiza el evento).
    // Las listas de compras no van al calendario.
    const g = updatedTask.tipo === "shopping" ? null : await loadGoogleSync();
    const googleEventId = g ? await g.syncTaskToGoogle(req.user.id, updatedTask) : null;
    if (googleEventId) {
      updatedTask.googleEventId = googleEventId;
    }

    await updatedTask.populate(POPULATE_COLABS);
    res.status(200).json(serializeTask(updatedTask, req.user.id));
  } catch (error) {
    console.error("Error al actualizar la tarea:", error);
    res
      .status(500)
      .json({ message: "Error en el servidor al actualizar la tarea" });
  }
};

// ============================================================================
// 👥 COMPARTIR TAREAS (tarea colaborativa entre usuarios)
// ============================================================================

// @desc  Buscar usuarios por @usuario para invitar a una tarea
// @route GET /api/task/buscar-usuario?u=texto
export const buscarUsuarioTarea = async (req, res) => {
  try {
    const q = String(req.query.u || "").trim().replace(/^@/, "");
    if (q.length < 2) return res.status(200).json({ usuarios: [] });
    const rx = new RegExp("^" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const users = await User.find({ username: rx, _id: { $ne: req.user.id } })
      .select("username fullName profilePhotoUrl")
      .limit(8);
    res.status(200).json({ usuarios: users.map(pubUser) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al buscar usuario" });
  }
};

// @desc  Invitar a un usuario a colaborar en una tarea
// @route POST /api/task/:id/compartir   body: { username } o { userId }
export const compartirTarea = async (req, res) => {
  try {
    const { username, userId: targetId } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Tarea no encontrada" });

    // Solo el dueño o un colaborador aceptado puede invitar a más gente.
    if (!puedeEditarTarea(task, req.user.id)) {
      return res.status(403).json({ message: "No autorizado" });
    }

    let target = null;
    if (targetId) target = await User.findById(targetId);
    else if (username)
      target = await User.findOne({
        username: String(username).trim().replace(/^@/, ""),
      });
    if (!target) return res.status(404).json({ message: "Usuario no encontrado" });

    if (target._id.toString() === task.user.toString()) {
      return res.status(400).json({ message: "Esa persona ya es la dueña de la tarea" });
    }
    const ya = (task.colaboradores || []).find(
      (c) => c.user.toString() === target._id.toString()
    );
    if (ya) {
      return res.status(200).json({
        message: ya.estado === "aceptado" ? "Ya colabora en la tarea" : "Ya tiene una invitación pendiente",
        estado: ya.estado,
        usuario: pubUser(target),
      });
    }

    task.colaboradores.push({ user: target._id, estado: "pendiente" });
    await task.save();
    res.status(200).json({ message: "Invitación enviada", usuario: pubUser(target) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al compartir la tarea" });
  }
};

// @desc  Invitaciones pendientes de tareas para el usuario actual
// @route GET /api/task/invitaciones
export const getInvitacionesTarea = async (req, res) => {
  try {
    const oid = new mongoose.Types.ObjectId(req.user.id);
    const tasks = await Task.find({
      colaboradores: { $elemMatch: { user: oid, estado: "pendiente" } },
    })
      .populate({ path: "user", select: "username fullName profilePhotoUrl" })
      .sort({ updatedAt: -1 });
    const invitaciones = tasks.map((t) => ({
      id: String(t._id),
      meta: t.meta,
      tipo: t.tipo,
      fecha: normalizeTaskDate(t.fecha),
      de: pubUser(t.user),
    }));
    res.status(200).json({ invitaciones });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al traer invitaciones" });
  }
};

// @desc  Aceptar una invitación a una tarea compartida
// @route POST /api/task/:id/aceptar
export const aceptarInvitacionTarea = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Tarea no encontrada" });
    const colab = (task.colaboradores || []).find(
      (c) => c.user.toString() === req.user.id
    );
    if (!colab) return res.status(404).json({ message: "No tenés una invitación a esta tarea" });
    colab.estado = "aceptado";
    task.markModified("colaboradores");
    await task.save();
    await task.populate(POPULATE_COLABS);
    // Devolvemos la tarea completa para que el cliente la muestre al instante.
    res.status(200).json({
      message: "Te uniste a la tarea",
      id: String(task._id),
      tarea: serializeTask(task, req.user.id),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al aceptar la invitación" });
  }
};

// @desc  Rechazar una invitación o salir de una tarea compartida (se quita a sí mismo)
// @route POST /api/task/:id/salir
export const salirDeTarea = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Tarea no encontrada" });
    const estaba = (task.colaboradores || []).some(
      (c) => c.user.toString() === req.user.id
    );
    if (!estaba) return res.status(404).json({ message: "No estás en esta tarea" });
    task.colaboradores = task.colaboradores.filter(
      (c) => c.user.toString() !== req.user.id
    );
    await task.save();
    res.status(200).json({ message: "Listo", id: String(task._id) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al salir de la tarea" });
  }
};

// @desc  El dueño quita a un colaborador de una tarea
// @route DELETE /api/task/:id/colaborador/:userId
export const quitarColaborador = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Tarea no encontrada" });
    if (task.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Solo el dueño puede quitar colaboradores" });
    }
    task.colaboradores = task.colaboradores.filter(
      (c) => c.user.toString() !== req.params.userId
    );
    await task.save();
    res.status(200).json({ message: "Colaborador quitado", id: String(task._id) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al quitar colaborador" });
  }
};
