import mongoose from "mongoose";

const splitSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amountMinor: { type: Number, required: true, validate: Number.isInteger, min: 1 },
    percent: { type: Number, min: 0, max: 100 }
  },
  { _id: false }
);

const groupExpenseSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    payerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, trim: true, default: "" },
    amountMinor: { type: Number, required: true, validate: Number.isInteger, min: 1 },
    splitType: { type: String, enum: ["EQUAL", "EXACT", "PERCENT"], required: true },
    splits: { type: [splitSchema], required: true },
    date: { type: Date, required: true, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.models.GroupExpense || mongoose.model("GroupExpense", groupExpenseSchema);
