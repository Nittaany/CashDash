import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    paymentHandle: { type: String, trim: true },
    currency: { type: String, enum: ["NPR", "INR", "USD"], default: "NPR" },
    walletBalanceMinor: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    isDemo: { type: Boolean, default: false },
    refreshTokenHash: { type: String, select: false }
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", userSchema);
