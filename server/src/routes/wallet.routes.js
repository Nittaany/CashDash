import { Router } from "express";
import { z } from "zod";
import User from "../models/User.js";
import { AppError } from "../middleware/errorHandler.js";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Zod schemas
const topupSchema = z.strictObject({
  amountMinor: z.number().int().positive().max(1e12)
});

// GET /api/wallet - Get wallet balance and monthly summary
router.get("/", authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      throw new AppError(404, "User not found");
    }

    // Import PersonalExpense here to avoid circular deps
    const PersonalExpense = (await import("../models/PersonalExpense.js")).default;

    // Get current month's expenses aggregated by category
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyAggregation = await PersonalExpense.aggregate([
      {
        $match: {
          userId: user._id,
          date: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: "$category",
          totalMinor: { $sum: "$amountMinor" }
        }
      }
    ]);

    const byCategory = {};
    let totalSpentMinor = 0;
    for (const item of monthlyAggregation) {
      byCategory[item._id] = item.totalMinor;
      totalSpentMinor += item.totalMinor;
    }

    res.json({
      walletBalanceMinor: user.walletBalanceMinor,
      currency: user.currency,
      monthlySummary: {
        totalSpentMinor,
        byCategory
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/wallet/topup - Add funds to wallet
router.post("/topup", authenticate, validate({ body: topupSchema }), async (req, res, next) => {
  try {
    const { amountMinor } = req.validated.body;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $inc: { walletBalanceMinor: amountMinor } },
      { new: true }
    );

    if (!user) {
      throw new AppError(404, "User not found");
    }

    res.json({
      walletBalanceMinor: user.walletBalanceMinor,
      currency: user.currency
    });
  } catch (error) {
    next(error);
  }
});

export default router;
