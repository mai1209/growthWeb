import mongoose from "mongoose";

// Último momento en que un usuario "vio" una conversación. Sirve para contar
// los mensajes no leídos (los que llegaron después de lastSeen).
const chatReadSchema = new mongoose.Schema(
  {
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    convo: { type: String, required: true },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

chatReadSchema.index({ usuario: 1, convo: 1 }, { unique: true });

const ChatRead = mongoose.models.ChatRead || mongoose.model("ChatRead", chatReadSchema);
export default ChatRead;
