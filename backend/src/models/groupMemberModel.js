import mongoose from "mongoose";

// Membresía a un club/grupo.
const groupMemberSchema = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rol: { type: String, default: "miembro" }, // owner | miembro
  },
  { timestamps: true }
);

groupMemberSchema.index({ group: 1, user: 1 }, { unique: true });
groupMemberSchema.index({ user: 1 });

const GroupMember = mongoose.models.GroupMember || mongoose.model("GroupMember", groupMemberSchema);
export default GroupMember;
