import mongoose from "mongoose";

// Posteo de comunidad: puede ser una actividad compartida (con su recorrido)
// o un posteo de texto/foto. `kudos` guarda los usuarios que dieron 👏.
const postSchema = new mongoose.Schema(
  {
    autor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Si el posteo pertenece a un club, acá va su id (si no, null = feed general).
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", default: null, index: true },
    tipo: { type: String, enum: ["actividad", "texto"], default: "texto" },
    texto: { type: String, default: "", trim: true, maxlength: 600 },
    foto: { type: String, default: "" }, // data URL o URL
    actividad: {
      tipo: String, // caminata | carrera | bici
      metros: Number,
      secs: Number,
      kcal: Number,
      fecha: String,
      ruta: {
        type: [{ _id: false, latitude: Number, longitude: Number }],
        default: undefined,
      },
    },
    kudos: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], default: [] },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });

const Post = mongoose.models.Post || mongoose.model("Post", postSchema);
export default Post;
