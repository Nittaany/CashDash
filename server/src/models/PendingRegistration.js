import mongoose from "mongoose";

const pendingRegistrationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    emailVerifyTokenHash: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    paymentHandle: { type: String, trim: true },
    currency: { type: String, enum: ["NPR", "INR", "USD"], default: "NPR" },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  { timestamps: true }
);

export default mongoose.models.PendingRegistration ||
  mongoose.model("PendingRegistration", pendingRegistrationSchema);
