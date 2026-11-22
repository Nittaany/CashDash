import mongoose from "mongoose";

const settlementSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amountMinor: { type: Number, required: true, validate: Number.isInteger, min: 1 },
    note: { type: String, trim: true, default: "" },
    settledAt: { type: Date, required: true, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.models.Settlement || mongoose.model("Settlement", settlementSchema);
