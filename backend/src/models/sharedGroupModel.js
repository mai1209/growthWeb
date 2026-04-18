import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    username: {
      type: String,
      default: "",
      trim: true,
    },
    isOwner: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const splitConfigSchema = new mongoose.Schema(
  {
    participantEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    percentage: {
      type: Number,
      default: null,
    },
    amount: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
);

const sharedGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    currency: {
      type: String,
      enum: ["ARS", "USD"],
      default: "ARS",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participants: {
      type: [participantSchema],
      default: [],
    },
    splitMode: {
      type: String,
      enum: ["equal", "percentage", "amount"],
      default: "equal",
    },
    splitConfig: {
      type: [splitConfigSchema],
      default: [],
    },
    archived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

sharedGroupSchema.index({ owner: 1, createdAt: -1 });
sharedGroupSchema.index({ "participants.email": 1 });

export default mongoose.model("SharedGroup", sharedGroupSchema);
