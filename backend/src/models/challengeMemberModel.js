import mongoose from "mongoose";

// Inscripción de un usuario a un reto.
const challengeMemberSchema = new mongoose.Schema(
  {
    challenge: { type: mongoose.Schema.Types.ObjectId, ref: "Challenge", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

challengeMemberSchema.index({ challenge: 1, user: 1 }, { unique: true });
challengeMemberSchema.index({ user: 1 });

const ChallengeMember =
  mongoose.models.ChallengeMember || mongoose.model("ChallengeMember", challengeMemberSchema);
export default ChallengeMember;
