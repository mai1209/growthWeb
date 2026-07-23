import mongoose from "mongoose";

// Journaling diario: una entrada por usuario y por día (fecha local del
// cliente). Como las afirmaciones, es personal: sin workspace.
// Formato guiado estilo "5 minute journal" + campo libre + ánimo.
const journalSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Fecha local "YYYY-MM-DD" a la que pertenece la entrada.
    fecha: {
      type: String,
      required: true,
    },
    // Ánimo del día: 1 (muy mal) a 5 (muy bien). 0 = sin marcar.
    animo: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    gratitud: { type: String, default: "" }, // Hoy agradezco…
    mejor: { type: String, default: "" }, // Lo mejor de hoy fue…
    distinto: { type: String, default: "" }, // ¿Qué harías distinto?
    libre: { type: String, default: "" }, // Notas libres
  },
  { timestamps: true }
);

journalSchema.index({ usuario: 1, fecha: -1 }, { unique: true });

const Journal = mongoose.model("Journal", journalSchema);

export default Journal;
