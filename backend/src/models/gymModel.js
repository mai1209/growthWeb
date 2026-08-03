import mongoose from "mongoose";

// Datos de Gym / entrenamiento. Personales: un documento por usuario.
// - ejercicios: biblioteca propia del usuario (además de la base que vive en el código).
// - rutinas: plantillas reutilizables [{ id, nombre, dia, ejercicios: [{ nombre, grupo, series, reps }] }]
// - entrenos: por día { "YYYY-MM-DD": [{ id, nombre, grupo, sets: [{ kg, reps, hecha }] }] }.
//   Se mergea por día en el PUT (el que escribe un día pisa ese día), como en Salud.
const gymSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    ejercicios: { type: mongoose.Schema.Types.Mixed, default: [] },
    rutinas: { type: mongoose.Schema.Types.Mixed, default: [] },
    entrenos: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false }
);

const Gym = mongoose.model("Gym", gymSchema);

export default Gym;
