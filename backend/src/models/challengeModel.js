import mongoose from "mongoose";

// Reto / desafío (Fase 3). Por ahora tipo "distancia": sumar metros en un
// período. El progreso NO se guarda: se calcula al vuelo desde las caminatas
// del usuario (saludModel) dentro de [inicio, fin] y filtrando por deporte.
const challengeSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, maxlength: 80 },
    descripcion: { type: String, default: "", maxlength: 400 },
    tipo: { type: String, default: "distancia" }, // por ahora solo "distancia"
    meta: { type: Number, required: true }, // metros a completar
    deporte: { type: String, default: "mixto" }, // caminata | carrera | bici | mixto
    inicio: { type: String, required: true }, // "YYYY-MM-DD" (fecha local del cliente)
    fin: { type: String, required: true }, // "YYYY-MM-DD"
    creador: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    publico: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Challenge = mongoose.models.Challenge || mongoose.model("Challenge", challengeSchema);
export default Challenge;
