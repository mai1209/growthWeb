import mongoose from "mongoose";

// Relación de "seguir" (grafo social): `seguidor` sigue a `seguido`.
const followSchema = new mongoose.Schema(
  {
    seguidor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    seguido: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Un usuario no puede seguir dos veces al mismo.
followSchema.index({ seguidor: 1, seguido: 1 }, { unique: true });
followSchema.index({ seguido: 1 });

const Follow = mongoose.models.Follow || mongoose.model("Follow", followSchema);
export default Follow;
