import mongoose from "mongoose";

// Mensaje de chat. Sirve para DM (privado 1-a-1) y para el chat de club.
// `convo` identifica la conversación:
//   - DM:   "d:<idA>_<idB>"  (ids ordenados)
//   - Club: "g:<grupoId>"
// `participantes` guarda los dos usuarios en un DM (para armar la bandeja).
const messageSchema = new mongoose.Schema(
  {
    convo: { type: String, required: true },
    autor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    participantes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    grupo: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
    texto: { type: String, required: true },
  },
  { timestamps: true }
);

messageSchema.index({ convo: 1, createdAt: -1 });
messageSchema.index({ participantes: 1, createdAt: -1 });

const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
export default Message;
