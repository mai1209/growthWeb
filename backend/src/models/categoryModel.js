import mongoose from "mongoose";

// Categorías personalizadas del usuario, con un emoji como ícono.
// Se usan para autocompletar el campo "categoría" al cargar movimientos.
const categorySchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    icono: {
      type: String,
      default: "🏷️",
      maxlength: 8,
    },
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Un usuario no repite nombres de categoría
categorySchema.index({ usuario: 1, nombre: 1 }, { unique: true });

export default mongoose.model("Category", categorySchema);
