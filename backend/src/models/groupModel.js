import mongoose from "mongoose";

// Club/grupo de la comunidad (p. ej. "Corredores Santa Fe").
const groupSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, maxlength: 60 },
    descripcion: { type: String, default: "", trim: true, maxlength: 400 },
    deporte: { type: String, default: "mixto" }, // caminata | carrera | bici | mixto
    zona: { type: String, default: "", trim: true, maxlength: 80 },
    foto: { type: String, default: "" }, // data URL o URL
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    publico: { type: Boolean, default: true },
  },
  { timestamps: true }
);

groupSchema.index({ nombre: 1 });

const Group = mongoose.models.Group || mongoose.model("Group", groupSchema);
export default Group;
