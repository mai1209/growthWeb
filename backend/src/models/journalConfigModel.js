import mongoose from "mongoose";

// Configuración del journaling: el texto de las 3 preguntas guiadas.
// Los campos de las entradas siguen siendo los mismos (gratitud/mejor/
// distinto); lo que se personaliza es cómo se formula cada pregunta.
const journalConfigSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    preguntas: {
      gratitud: { type: String, default: "" },
      mejor: { type: String, default: "" },
      distinto: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

const JournalConfig = mongoose.model("JournalConfig", journalConfigSchema);

export default JournalConfig;
