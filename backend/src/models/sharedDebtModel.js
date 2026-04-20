import mongoose from "mongoose";

const sharedDebtSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SharedGroup",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    debtorEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    creditorEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      enum: ["ARS", "USD"],
      default: "ARS",
    },
    date: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["open", "paid"],
      default: "open",
    },
    paymentMethod: {
      type: String,
      enum: ["efectivo", "transferencia", null],
      default: null,
    },
    settledAt: {
      type: Date,
      default: null,
    },
    settledByUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    settledByEmail: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
    },
    movementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "IngresoEgreso",
      default: null,
    },
  },
  { timestamps: true }
);

sharedDebtSchema.index({ group: 1, status: 1, date: -1, createdAt: -1 });

export default mongoose.model("SharedDebt", sharedDebtSchema);
