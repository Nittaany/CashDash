import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import User from "../models/User.js";
import PersonalExpense from "../models/PersonalExpense.js";
import { AppError } from "../middleware/errorHandler.js";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Zod schemas
const createExpenseSchema = z.strictObject({
  amountMinor: z.number().int().positive().max(1e12),
  category: z.string().min(1).max(50),
  description: z.string().max(500),
  paymentMode: z.enum(["CASH", "BANK", "WALLET", "CARD", "UPI"]),
  date: z.coerce.date()
});

const listExpensesQuerySchema = z.object({
  category: z.string().optional(),
  paymentMode: z.enum(["CASH", "BANK", "WALLET", "CARD", "UPI"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

// GET /api/expenses - List user's personal expenses
router.get("/", authenticate, validate({ query: listExpensesQuerySchema }), async (req, res, next) => {
  try {
    const { category, paymentMode, from, to, page, limit } = req.validated.query;

    const filter = { userId: req.user.userId };
    if (category) filter.category = category;
    if (paymentMode) filter.paymentMode = paymentMode;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }

    const [expenses, total] = await Promise.all([
      PersonalExpense.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      PersonalExpense.countDocuments(filter)
    ]);

    res.json({
      expenses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/expenses - Create expense with ACID transaction (deducts from wallet)
router.post("/", authenticate, validate({ body: createExpenseSchema }), async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    let expense;
    await session.withTransaction(async () => {
      const { amountMinor, category, description, paymentMode, date } = req.validated.body;

      // Atomically check and deduct wallet balance
      const user = await User.findOneAndUpdate(
        {
          _id: req.user.userId,
          walletBalanceMinor: { $gte: amountMinor }
        },
        { $inc: { walletBalanceMinor: -amountMinor } },
        { session, new: true }
      );

      if (!user) {
        throw new AppError(400, "Insufficient wallet balance");
      }

      [expense] = await PersonalExpense.create(
        [{
          userId: req.user.userId,
          amountMinor,
          category,
          description,
          paymentMode,
          date
        }],
        { session }
      );
    });

    res.status(201).json({ expense });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
});

// DELETE /api/expenses/:id - Delete expense and refund to wallet
router.delete("/:id", authenticate, async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const expense = await PersonalExpense.findOneAndDelete(
        { _id: req.params.id, userId: req.user.userId },
        { session }
      );

      if (!expense) {
        throw new AppError(404, "Expense not found");
      }

      // Refund to wallet
      await User.findByIdAndUpdate(
        req.user.userId,
        { $inc: { walletBalanceMinor: expense.amountMinor } },
        { session }
      );
    });

    res.json({ message: "Expense deleted and refunded" });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
});

export default router;
