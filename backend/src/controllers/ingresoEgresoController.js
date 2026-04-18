import IngresoEgresoModel from "../models/ingresoEgresoModel.js";
import mongoose from 'mongoose'; 

const normalizeMovementDate = (value) => {
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

const normalizeMovementMethod = (value) =>
  value === "transferencia" ? "transferencia" : "efectivo";

const serializeMovimiento = (movimiento) => {
  const raw = typeof movimiento.toObject === "function" ? movimiento.toObject() : movimiento;

  return {
    ...raw,
    fecha: normalizeMovementDate(raw.fecha),
  };
};

export const createIncomeEgress = async (req, res) => {
  try {
    const {
      tipo,
      monto,
      categoria,
      fecha,
      detalle,
      medio,
      moneda,
      esRecurrente,
      frecuencia,
    } = req.body;
    const userId = req.userId; // 🔥 Obtenido del middleware de autenticación

    // Validaciones
    if (!tipo || !["ingreso", "egreso", "ahorro"].includes(tipo)) {
      return res.status(400).json({ error: "El tipo debe ser 'ingreso', 'egreso' o 'ahorro'" });
    }
    if (!monto || isNaN(monto)) {
      return res.status(400).json({ error: "El monto es obligatorio y debe ser un número" });
    }
    if (!categoria) {
      return res.status(400).json({ error: "La categoría es obligatoria" });
    }
    if (moneda && !["ARS", "USD"].includes(moneda)) {
      return res.status(400).json({ error: "La moneda debe ser ARS o USD" });
    }
    if (medio && !["efectivo", "transferencia"].includes(medio)) {
      return res.status(400).json({ error: "El medio debe ser efectivo o transferencia" });
    }
    if (esRecurrente && !["mensual", "quincenal", "semanal"].includes(frecuencia)) {
      return res.status(400).json({ error: "La frecuencia debe ser mensual, quincenal o semanal" });
    }

    // Crear nuevo documento vinculado al usuario
    const nuevoMovimiento = new IngresoEgresoModel({
      tipo,
      monto,
      moneda: moneda || "ARS",
      categoria,
      fecha: normalizeMovementDate(fecha),
      detalle,
      medio: normalizeMovementMethod(medio),
      esRecurrente: Boolean(esRecurrente),
      frecuencia: esRecurrente ? frecuencia : null,
      usuario: userId // 🔥 Vincular con el usuario
    });

    const movimientoGuardado = await nuevoMovimiento.save();
    res.status(201).json(serializeMovimiento(movimientoGuardado));
  } catch (error) {
    console.error("Error al guardar el movimiento:", error);
    res.status(500).json({ error: "Error al guardar el movimiento" });
  }
}

export const getIncomeEgress = async (req, res) => {
  console.log("\n--- INICIANDO BÚSQUEDA DE MOVIMIENTOS ---");
  try {
    const userId = req.userId;
    console.log("1. ID de usuario del token (req.userId):", userId);

    if (!userId) {
      console.log("ERROR: No se encontró userId en la petición. Revisa el middleware requireAuth.");
      return res.status(401).json({ error: "No autorizado." });
    }

    const { fecha } = req.query;
    const query = { usuario: new mongoose.Types.ObjectId(userId) };
    
    console.log("2. Creando consulta para la base de datos...");

    if (fecha) {
      const startDate = new Date(fecha);
      startDate.setUTCHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 1);
      query.fecha = { $gte: startDate, $lt: endDate };
      console.log(`   - Se añadió filtro de fecha: ${fecha}`);
    } else {
      console.log("   - No hay filtro de fecha. Se buscarán todos los movimientos.");
    }

    console.log("3. Consulta final que se enviará a MongoDB:", JSON.stringify(query));

    const movimientos = await IngresoEgresoModel.find(query).sort({ fecha: -1 });

    console.log(`4. ¡Búsqueda completada! Movimientos encontrados: ${movimientos.length}`);
    
    if (movimientos.length > 0) {
      console.log("   - Primer movimiento encontrado:", movimientos[0]);
    } else {
      console.log("   - La base de datos NO devolvió ningún documento para esta consulta.");
      console.log("   - POSIBLE CAUSA: El ID de usuario del token no coincide con el campo 'usuario' en tus documentos de la base de datos.");
    }
    
    console.log("--- BÚSQUEDA TERMINADA. Enviando respuesta al frontend. ---\n");
    res.status(200).json(movimientos.map(serializeMovimiento));

  } catch (error) {
    console.error("Error al obtener los movimientos:", error);
    res.status(500).json({ error: "Error al obtener los movimientos" });
  }
};
export const getIncomeEgressById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    // --- CORRECCIÓN AQUÍ ---
    // La consulta ahora busca por '_id' y se asegura de que el campo 'usuario'
    // coincida con el 'userId' del usuario que está logueado.
    const movimiento = await IngresoEgresoModel.findOne({ 
      _id: id, 
      usuario: userId 
    });
    
    if (!movimiento) {
      // Este error puede significar que el movimiento no existe O que no le pertenece al usuario.
      return res.status(404).json({ error: "Movimiento no encontrado o no autorizado" });
    }
    
    res.status(200).json(serializeMovimiento(movimiento));
  } catch (error) {
    console.error("Error al obtener el movimiento:", error);
    res.status(500).json({ error: "Error al obtener el movimiento" });
  }
}
// En /backend/src/controllers/ingresoEgresoController.js


export const updateIncomeEgress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    const movimiento = await IngresoEgresoModel.findById(id);
    
    if (!movimiento) {
      return res.status(404).json({ error: "Movimiento no encontrado" });
    }

    // --- 👇 LA CORRECCIÓN ESTÁ AQUÍ 👇 ---
    // Convertimos AMBOS IDs a texto (string) antes de comparar
    if (movimiento.usuario.toString() !== userId.toString()) {
      return res.status(401).json({ error: "No autorizado" });
    }
    
    const {
      tipo,
      monto,
      categoria,
      fecha,
      detalle,
      medio,
      moneda,
      esRecurrente,
      frecuencia,
    } = req.body;

    if (moneda && !["ARS", "USD"].includes(moneda)) {
      return res.status(400).json({ error: "La moneda debe ser ARS o USD" });
    }
    if (medio && !["efectivo", "transferencia"].includes(medio)) {
      return res.status(400).json({ error: "El medio debe ser efectivo o transferencia" });
    }
    if (tipo && !["ingreso", "egreso", "ahorro"].includes(tipo)) {
      return res.status(400).json({ error: "Tipo de movimiento inválido" });
    }
    if (esRecurrente && !["mensual", "quincenal", "semanal"].includes(frecuencia)) {
      return res.status(400).json({ error: "La frecuencia debe ser mensual, quincenal o semanal" });
    }

    movimiento.tipo = tipo ?? movimiento.tipo;
    movimiento.monto = monto ?? movimiento.monto;
    movimiento.categoria = categoria ?? movimiento.categoria;
    movimiento.fecha = fecha ? normalizeMovementDate(fecha) : movimiento.fecha;
    movimiento.detalle = detalle ?? movimiento.detalle;
    movimiento.medio = medio ? normalizeMovementMethod(medio) : movimiento.medio ?? "efectivo";
    movimiento.moneda = moneda ?? movimiento.moneda ?? "ARS";
    movimiento.esRecurrente = esRecurrente ?? movimiento.esRecurrente;
    movimiento.frecuencia = movimiento.esRecurrente
      ? frecuencia ?? movimiento.frecuencia
      : null;
    
    const movimientoActualizado = await movimiento.save();
    
    res.status(200).json(serializeMovimiento(movimientoActualizado));
  } catch (error) {
    console.error("Error al actualizar el movimiento:", error);
    res.status(500).json({ error: "Error al actualizar el movimiento" });
  }
}

export const deleteIncomeEgress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    // Verificar que el movimiento pertenezca al usuario
    const movimiento = await IngresoEgresoModel.findOne({ 
      _id: id, 
      usuario: userId 
    });
    
    if (!movimiento) {
      return res.status(404).json({ error: "Movimiento no encontrado" });
    }
    
    await IngresoEgresoModel.findByIdAndDelete(id);
    res.status(200).json({ message: "Movimiento eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar el movimiento:", error);
    res.status(500).json({ error: "Error al eliminar el movimiento" });
  }
}

export const getAllIncomeEgress = async (req, res) => {
  console.log("📦 GET /api/add/all ejecutado");

  try {
    const userId = req.userId;
    console.log("🧠 ID del usuario autenticado:", userId, typeof userId);

    if (!userId) {
      return res.status(401).json({ error: "No autorizado." });
    }

    const movimientos = await IngresoEgresoModel.find({ usuario: new mongoose.Types.ObjectId(userId) }).sort({ fecha: -1 });
    console.log("✅ Movimientos encontrados:", movimientos.length);

    res.status(200).json(movimientos.map(serializeMovimiento));
  } catch (error) {
    console.error("💥 Error al obtener todos los movimientos:", error);
    console.error(error.stack);
    res.status(500).json({ error: "Error al obtener todos los movimientos", details: error.message });
  }
};
