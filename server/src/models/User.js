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
    isEmailVerified: { type: Boolean, default: false },
    emailVerifyTokenHash: { type: String, select: false },
    emailVerifyExpiresAt: { type: Date, select: false },
    refreshTokenHash: { type: String, select: false },
    resetTokenHash: { type: String, select: false },
    resetTokenExpiresAt: { type: Date, select: false },
    expiresAt: { type: Date, index: { expires: 0 } } // TTL index for ephemeral demo users
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", userSchema);
