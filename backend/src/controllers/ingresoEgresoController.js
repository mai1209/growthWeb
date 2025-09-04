import IngresoEgresoModel from "../models/ingresoEgresoModel.js";
import mongoose from 'mongoose'; 
export const createIncomeEgress = async (req, res) => {
  try {
    const { tipo, monto, categoria, fecha, detalle } = req.body;
    const userId = req.userId; // 🔥 Obtenido del middleware de autenticación

    // Validaciones
    if (!tipo || !["ingreso", "egreso"].includes(tipo)) {
      return res.status(400).json({ error: "El tipo debe ser 'ingreso' o 'egreso'" });
    }
    if (!monto || isNaN(monto)) {
      return res.status(400).json({ error: "El monto es obligatorio y debe ser un número" });
    }
    if (!categoria) {
      return res.status(400).json({ error: "La categoría es obligatoria" });
    }

    // Crear nuevo documento vinculado al usuario
    const nuevoMovimiento = new IngresoEgresoModel({
      tipo,
      monto,
      categoria,
      fecha: fecha ? new Date(fecha) : new Date(),
      detalle,
      usuario: userId // 🔥 Vincular con el usuario
    });

    const movimientoGuardado = await nuevoMovimiento.save();
    res.status(201).json(movimientoGuardado);
  } catch (error) {
    console.error("Error al guardar el movimiento:", error);
    res.status(500).json({ error: "Error al guardar el movimiento" });
  }
}

// --- REEMPLAZA ESTA FUNCIÓN ---
export const getIncomeEgress = async (req, res) => {
  try {
    const userId = req.userId;
    
    // 1. Obtenemos la fecha de los parámetros de la URL (ej: /api/add?fecha=2025-09-02)
    const { fecha } = req.query;

    // 2. Creamos un objeto de consulta base para filtrar siempre por el usuario logueado
    const query = {
      usuario: new mongoose.Types.ObjectId(userId)
    };

    // 3. Si se proporciona una fecha, añadimos el filtro de rango al objeto de consulta
    if (fecha) {
      // Creamos la fecha de inicio del día (ej: 2025-09-02 a las 00:00:00 UTC)
      const startDate = new Date(fecha);
      startDate.setUTCHours(0, 0, 0, 0);

      // Creamos la fecha de fin (el día siguiente a las 00:00:00 UTC)
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 1);

      // Añadimos la condición al query: busca movimientos con fecha >= startDate Y < endDate
      query.fecha = {
        $gte: startDate,
        $lt: endDate
      };
    }
    
    console.log(`Buscando movimientos con el filtro:`, query);

    // 4. Ejecutamos la consulta final y ordenamos por fecha descendente
    const movimientos = await IngresoEgresoModel.find(query).sort({ fecha: -1 });
    
    res.status(200).json(movimientos);
  } catch (error) {
    console.error("Error al obtener los movimientos:", error);
    res.status(500).json({ error: "Error al obtener los movimientos" });
  }
};

export const getIncomeEgressById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    const movimiento = await IngresoEgresoModel.findOne({ 
      _id: id, 
      usuario: userId 
    });
    
    if (!movimiento) {
      return res.status(404).json({ error: "Movimiento no encontrado" });
    }
    
    res.status(200).json(movimiento);
  } catch (error) {
    console.error("Error al obtener el movimiento:", error);
    res.status(500).json({ error: "Error al obtener el movimiento" });
  }
}

export const updateIncomeEgress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const updateData = req.body;
    
    // Verificar que el movimiento pertenezca al usuario
    const movimiento = await IngresoEgresoModel.findOne({ 
      _id: id, 
      usuario: userId 
    });
    
    if (!movimiento) {
      return res.status(404).json({ error: "Movimiento no encontrado" });
    }
    
    // Actualizar
    const movimientoActualizado = await IngresoEgresoModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.status(200).json(movimientoActualizado);
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


