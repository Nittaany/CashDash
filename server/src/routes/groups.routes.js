import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import User from "../models/User.js";
import Group from "../models/Group.js";
import GroupExpense from "../models/GroupExpense.js";
import Settlement from "../models/Settlement.js";
import { AppError } from "../middleware/errorHandler.js";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import { calculateSplits } from "../services/splitCalculator.js";
import { simplifyDebts } from "../services/debtSimplifier.js";

const router = Router();

// Zod schemas
const createGroupSchema = z.strictObject({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  currency: z.enum(["NPR", "INR", "USD"]).optional(),
  memberEmails: z.array(z.string().email()).max(20).optional()
});

const addMemberSchema = z.strictObject({
  email: z.string().email().max(255).toLowerCase()
});

const createGroupExpenseSchema = z.strictObject({
  description: z.string().min(1).max(500),
  amountMinor: z.number().int().positive().max(1e12),
  payerId: z.string(),
  splitType: z.enum(["EQUAL", "EXACT", "PERCENT"]),
  participants: z.array(z.string()).min(1).max(50),
  exactSharesMinor: z.record(z.string(), z.number().int().positive().max(1e12)).optional(),
  percentShares: z.record(z.string(), z.number().min(0).max(100)).optional(),
  date: z.coerce.date().optional()
});

const createSettlementSchema = z.strictObject({
  fromUserId: z.string(),
  toUserId: z.string(),
  amountMinor: z.number().int().positive().max(1e12),
  note: z.string().max(500).optional()
});

// Helper: verify user is group member
async function verifyGroupMember(groupId, userId) {
  const group = await Group.findOne({
    _id: groupId,
    members: userId
  });
  if (!group) {
    throw new AppError(403, "Not a member of this group");
  }
  return group;
}

// Helper: get group member IDs as strings
function getMemberIds(group) {
  return group.members.map((m) => m.toString());
}

// Helper: neutralize CSV formula injection
function sanitizeCSVCell(value) {
  const str = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  // RFC4180: escape quotes and wrap in quotes if contains comma/newline/quote
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// POST /api/groups - Create group
router.post("/", authenticate, validate({ body: createGroupSchema }), async (req, res, next) => {
  try {
    const { name, description, currency, memberEmails } = req.validated.body;
    const members = [req.user.userId];

    // Resolve member emails to user IDs
    if (memberEmails?.length) {
      const users = await User.find({ email: { $in: memberEmails } }).select("_id");
      for (const user of users) {
        if (!members.includes(user._id.toString())) {
          members.push(user._id);
        }
      }
    }

    const group = await Group.create({
      name,
      description,
      currency,
      createdBy: req.user.userId,
      members
    });

    res.status(201).json({ group });
  } catch (error) {
    next(error);
  }
});

// GET /api/groups - List user's groups
router.get("/", authenticate, async (req, res, next) => {
  try {
    const groups = await Group.find({ members: req.user.userId })
      .populate("members", "_id name email paymentHandle")
      .populate("createdBy", "_id name email");

    res.json({ groups });
  } catch (error) {
    next(error);
  }
});

// POST /api/groups/:groupId/members - Add member to group
router.post("/:groupId/members", authenticate, validate({ body: addMemberSchema }), async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { email } = req.validated.body;

    await verifyGroupMember(groupId, req.user.userId);

    const userToAdd = await User.findOne({ email }).select("_id");
    if (!userToAdd) {
      throw new AppError(404, "User not found");
    }

    const group = await Group.findByIdAndUpdate(
      groupId,
      { $addToSet: { members: userToAdd._id } },
      { new: true }
    ).populate("members", "_id name email paymentHandle");

    res.json({ group });
  } catch (error) {
    next(error);
  }
});

// GET /api/groups/:groupId/summary - Get group summary with simplified debts
router.get("/:groupId/summary", authenticate, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const group = await verifyGroupMember(groupId, req.user.userId);
    await group.populate("members", "_id name email paymentHandle");

    const [expenses, settlements] = await Promise.all([
      GroupExpense.find({ groupId }).populate("payerId", "_id name email"),
      Settlement.find({ groupId })
    ]);

    // Compute simplified debts
    const expensesForCalc = expenses.map((e) => ({
      payerId: e.payerId._id.toString(),
      amountMinor: e.amountMinor,
      splits: e.splits.map((s) => ({
        userId: s.userId.toString(),
        amountMinor: s.amountMinor
      }))
    }));

    const settlementsForCalc = settlements.map((s) => ({
      fromUserId: s.fromUserId.toString(),
      toUserId: s.toUserId.toString(),
      amountMinor: s.amountMinor
    }));

    const simplifiedTransfers = simplifyDebts({
      expenses: expensesForCalc,
      settlements: settlementsForCalc
    });

    // Compute net balances per user
    const netBalances = {};
    for (const member of group.members) {
      netBalances[member._id.toString()] = 0;
    }
    for (const expense of expensesForCalc) {
      for (const split of expense.splits) {
        if (split.userId !== expense.payerId) {
          netBalances[split.userId] = (netBalances[split.userId] ?? 0) - split.amountMinor;
          netBalances[expense.payerId] = (netBalances[expense.payerId] ?? 0) + split.amountMinor;
        }
      }
    }
    for (const settlement of settlementsForCalc) {
      netBalances[settlement.fromUserId] = (netBalances[settlement.fromUserId] ?? 0) + settlement.amountMinor;
      netBalances[settlement.toUserId] = (netBalances[settlement.toUserId] ?? 0) - settlement.amountMinor;
    }

    res.json({
      group,
      expenses,
      settlements,
      netBalances,
      simplifiedTransfers
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/groups/:groupId/expenses - Create group expense
router.post("/:groupId/expenses", authenticate, validate({ body: createGroupExpenseSchema }), async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { description, amountMinor, payerId, splitType, participants, exactSharesMinor, percentShares, date } = req.validated.body;

    const group = await verifyGroupMember(groupId, req.user.userId);
    const memberIds = getMemberIds(group);

    // Validate payer is member
    if (!memberIds.includes(payerId)) {
      throw new AppError(400, "Payer must be a group member");
    }

    // Validate all participants are members
    for (const p of participants) {
      if (!memberIds.includes(p)) {
        throw new AppError(400, "All participants must be group members");
      }
    }

    // Calculate splits
    const splits = calculateSplits({
      amountMinor,
      splitType,
      participants,
      exactSharesMinor,
      percentShares
    });

    const expense = await GroupExpense.create({
      groupId,
      payerId,
      description,
      amountMinor,
      splitType,
      splits,
      date: date ?? new Date()
    });

    res.status(201).json({ expense });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/groups/:groupId/expenses/:expenseId - Delete group expense
router.delete("/:groupId/expenses/:expenseId", authenticate, async (req, res, next) => {
  try {
    const { groupId, expenseId } = req.params;
    const group = await verifyGroupMember(groupId, req.user.userId);

    const expense = await GroupExpense.findOne({ _id: expenseId, groupId });
    if (!expense) {
      throw new AppError(404, "Expense not found");
    }

    // Only payer or group creator can delete
    const isPayerOrCreator =
      expense.payerId.toString() === req.user.userId ||
      group.createdBy.toString() === req.user.userId;

    if (!isPayerOrCreator) {
      throw new AppError(403, "Only payer or group creator can delete this expense");
    }

    await expense.deleteOne();
    res.json({ message: "Expense deleted" });
  } catch (error) {
    next(error);
  }
});

// POST /api/groups/:groupId/settlements - Record settlement
router.post("/:groupId/settlements", authenticate, validate({ body: createSettlementSchema }), async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { fromUserId, toUserId, amountMinor, note } = req.validated.body;

    const group = await verifyGroupMember(groupId, req.user.userId);
    const memberIds = getMemberIds(group);

    // Validate both users are members
    if (!memberIds.includes(fromUserId) || !memberIds.includes(toUserId)) {
      throw new AppError(400, "Both users must be group members");
    }

    if (fromUserId === toUserId) {
      throw new AppError(400, "Cannot settle with yourself");
    }

    // Requester must be fromUserId or toUserId
    if (req.user.userId !== fromUserId && req.user.userId !== toUserId) {
      throw new AppError(403, "You can only create settlements you are part of");
    }

    // Verify amount doesn't exceed outstanding debt
    const [expenses, existingSettlements] = await Promise.all([
      GroupExpense.find({ groupId }),
      Settlement.find({ groupId })
    ]);

    const expensesForCalc = expenses.map((e) => ({
      payerId: e.payerId.toString(),
      amountMinor: e.amountMinor,
      splits: e.splits.map((s) => ({
        userId: s.userId.toString(),
        amountMinor: s.amountMinor
      }))
    }));

    const settlementsForCalc = existingSettlements.map((s) => ({
      fromUserId: s.fromUserId.toString(),
      toUserId: s.toUserId.toString(),
      amountMinor: s.amountMinor
    }));

    // Compute current net balance for fromUser
    let fromUserNet = 0;
    for (const expense of expensesForCalc) {
      for (const split of expense.splits) {
        if (split.userId === fromUserId && expense.payerId !== fromUserId) {
          fromUserNet -= split.amountMinor; // fromUser owes
        }
        if (expense.payerId === fromUserId && split.userId !== fromUserId) {
          fromUserNet += split.amountMinor; // fromUser is owed
        }
      }
    }
    for (const settlement of settlementsForCalc) {
      if (settlement.fromUserId === fromUserId) {
        fromUserNet += settlement.amountMinor;
      }
      if (settlement.toUserId === fromUserId) {
        fromUserNet -= settlement.amountMinor;
      }
    }

    // If fromUserNet < 0, user owes money. Settlement amount shouldn't exceed what they owe.
    if (fromUserNet >= 0) {
      throw new AppError(400, "No outstanding debt to settle");
    }
    if (amountMinor > Math.abs(fromUserNet)) {
      throw new AppError(400, `Settlement amount exceeds outstanding debt of ${Math.abs(fromUserNet)}`);
    }

    const settlement = await Settlement.create({
      groupId,
      fromUserId,
      toUserId,
      amountMinor,
      note
    });

    res.status(201).json({ settlement });
  } catch (error) {
    next(error);
  }
});

// GET /api/groups/:groupId/export.csv - Export group expenses as CSV
router.get("/:groupId/export.csv", authenticate, async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const group = await verifyGroupMember(groupId, req.user.userId);
    await group.populate("members", "_id name email");

    const expenses = await GroupExpense.find({ groupId })
      .populate("payerId", "_id name email")
      .sort({ date: -1 });

    // Build member lookup
    const memberMap = new Map();
    for (const m of group.members) {
      memberMap.set(m._id.toString(), m.name);
    }

    // CSV header
    const headers = ["Date", "Description", "Amount", "Payer", "Split Type", "Participants"];
    const rows = [headers.map(sanitizeCSVCell).join(",")];

    for (const expense of expenses) {
      const participants = expense.splits
        .map((s) => memberMap.get(s.userId.toString()) ?? "Unknown")
        .join("; ");

      const row = [
        expense.date?.toISOString().split("T")[0] ?? "",
        expense.description,
        (expense.amountMinor / 100).toFixed(2),
        expense.payerId?.name ?? "Unknown",
        expense.splitType,
        participants
      ];

      rows.push(row.map(sanitizeCSVCell).join(","));
    }

    const csv = rows.join("\n");
    const filename = `${group.name.replace(/[^a-zA-Z0-9]/g, "_")}_expenses.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

export default router;
