import mongoose from "mongoose";

// Proyecto / trabajo para agrupar las sesiones de registro de horas.
// Scoping por usuario + workspace (perfil), igual que el resto.
const projectSchema = new mongoose.Schema(
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
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      default: "#5dc72d",
      trim: true,
    },
    notas: {
      // Bloc de notas propio del proyecto (datos del cliente, pendientes, etc.).
      type: String,
      default: "",
    },
    archivado: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

projectSchema.index({ usuario: 1, workspace: 1, createdAt: -1 });

const Project = mongoose.model("Project", projectSchema);

export default Project;
