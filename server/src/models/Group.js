import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    currency: { type: String, enum: ["NPR", "INR", "USD"], default: "NPR" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
    settlementVersion: { type: Number, default: 0 }, // For optimistic concurrency on settlements
    expiresAt: { type: Date, index: { expires: 0 } } // TTL index for ephemeral demo groups
  },
  { timestamps: true }
);

// Compound index for listing user's groups sorted by recent activity
groupSchema.index({ members: 1, updatedAt: -1 });

export default mongoose.models.Group || mongoose.model("Group", groupSchema);
