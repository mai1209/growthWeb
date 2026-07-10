import CategoryModel from "../models/categoryModel.js";

// GET /api/categories — categorías del usuario, ordenadas por nombre
export const getCategories = async (req, res) => {
  try {
    const categorias = await CategoryModel.find({ usuario: req.userId }).sort({
      nombre: 1,
    });
    res.status(200).json(categorias);
  } catch (error) {
    console.error("Error al listar categorías:", error);
    res.status(500).json({ error: "Error al listar las categorías" });
  }
};

// POST /api/categories — crea (o devuelve la existente si el nombre ya está)
export const createCategory = async (req, res) => {
  try {
    const nombre = String(req.body.nombre || "").trim();
    const icono = String(req.body.icono || "🏷️").slice(0, 8);

    if (!nombre) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }
    if (nombre.length > 40) {
      return res.status(400).json({ error: "El nombre es demasiado largo" });
    }

    // Si ya existe (sin distinguir mayúsculas), actualizamos el ícono y la devolvemos
    const existente = await CategoryModel.findOne({
      usuario: req.userId,
      nombre: { $regex: `^${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });
    if (existente) {
      if (icono && icono !== existente.icono) {
        existente.icono = icono;
        await existente.save();
      }
      return res.status(200).json(existente);
    }

    const creada = await CategoryModel.create({
      nombre,
      icono,
      usuario: req.userId,
    });
    res.status(201).json(creada);
  } catch (error) {
    console.error("Error al crear categoría:", error);
    res.status(500).json({ error: "Error al crear la categoría" });
  }
};

// DELETE /api/categories/:id
export const deleteCategory = async (req, res) => {
  try {
    const eliminada = await CategoryModel.findOneAndDelete({
      _id: req.params.id,
      usuario: req.userId,
    });
    if (!eliminada) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Error al eliminar categoría:", error);
    res.status(500).json({ error: "Error al eliminar la categoría" });
  }
};
