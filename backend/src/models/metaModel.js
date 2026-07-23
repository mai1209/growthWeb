import mongoose from "mongoose";

// Meta personal (corto / mediano / largo plazo).
// Scoping por usuario + workspace, igual que el resto de la app.
const metaSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    workspace: {
      type: String,
      default: "personal",
      trim: true,
    },
    titulo: {
      type: String,
      required: true,
      trim: true,
    },
    descripcion: {
      type: String,
      default: "",
      trim: true,
    },
    // corto (semanas/meses) | mediano (este año) | largo (años)
    horizonte: {
      type: String,
      enum: ["corto", "mediano", "largo"],
      default: "corto",
    },
    // Área de vida a la que pertenece (Finanzas, Salud, Carrera...).
    area: {
      type: String,
      default: "",
      trim: true,
    },
    // Fecha objetivo local "YYYY-MM-DD" (opcional).
    fechaObjetivo: {
      type: String,
      default: "",
    },
    // Cómo se mide el avance:
    //  - hitos: checklist de pasos (progreso = hechos / total)
    //  - numero: valor actual vs. objetivo (ej: ahorrar $500.000)
    //  - manual: porcentaje que se ajusta a mano
    medicion: {
      type: String,
      enum: ["hitos", "numero", "manual"],
      default: "hitos",
    },
    hitos: {
      type: [
        {
          _id: false,
          texto: String,
          hecho: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    objetivoNumero: { type: Number, default: 0 },
    actualNumero: { type: Number, default: 0 },
    unidad: { type: String, default: "", trim: true },
    progresoManual: { type: Number, default: 0, min: 0, max: 100 },
    estado: {
      type: String,
      enum: ["activa", "pausada", "completada"],
      default: "activa",
    },
    completadaEn: { type: String, default: "" },
  },
  { timestamps: true }
);

metaSchema.index({ usuario: 1, workspace: 1, estado: 1, createdAt: -1 });

const Meta = mongoose.model("Meta", metaSchema);

export default Meta;
