import mongoose from "mongoose";

// Registro de horas de trabajo (estilo Toggl/Clockify). Cada entrada es una
// sesión ya terminada: tiene inicio, fin y duración en segundos. El cronómetro
// "en vivo" vive en el cliente; acá solo guardamos las sesiones cerradas.
// Scoping por usuario + workspace (perfil), igual que los movimientos.
const timeEntrySchema = new mongoose.Schema(
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
    proyecto: {
      // Proyecto/trabajo al que pertenece la sesión (null = "Sin proyecto").
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    descripcion: {
      type: String,
      default: "",
      trim: true,
    },
    inicio: {
      type: Date,
      required: true,
    },
    fin: {
      type: Date,
      required: true,
    },
    duracion: {
      // Duración en segundos (fin - inicio), guardada para consultar rápido.
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

timeEntrySchema.index({ usuario: 1, workspace: 1, inicio: -1 });

const TimeEntry = mongoose.model("TimeEntry", timeEntrySchema);

export default TimeEntry;
