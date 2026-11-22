import mongoose from "mongoose";

const personalExpenseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amountMinor: { type: Number, required: true, validate: Number.isInteger, min: 1 },
    category: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    paymentMode: { type: String, enum: ["CASH", "BANK", "WALLET", "CARD", "UPI"], required: true },
    date: { type: Date, required: true, index: true },
    expiresAt: { type: Date, index: { expires: 0 } } // TTL index for ephemeral demo expenses
  },
  { timestamps: true }
);

export default mongoose.models.PersonalExpense || mongoose.model("PersonalExpense", personalExpenseSchema);
