import mongoose from "mongoose";

// Notificación in-app: le llega a `usuario` (destinatario), la generó `actor`.
// tipo: follow (te empezó a seguir), solicitud (te pidió seguirte, cuenta
// privada), kudo, comentario. `post` opcional (para kudo/comentario).
const notificationSchema = new mongoose.Schema(
  {
    usuario: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tipo: { type: String, enum: ["follow", "solicitud", "kudo", "comentario"], required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
    leida: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ usuario: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
export default Notification;
