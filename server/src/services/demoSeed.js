import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import PersonalExpense from "../models/PersonalExpense.js";
import Group from "../models/Group.js";
import GroupExpense from "../models/GroupExpense.js";
import Settlement from "../models/Settlement.js";

// Fixed ObjectIds for idempotent seeding
const DEMO_USER_ID = new mongoose.Types.ObjectId("000000000000000000000001");
const AARAV_USER_ID = new mongoose.Types.ObjectId("000000000000000000000002");
const PRIYA_USER_ID = new mongoose.Types.ObjectId("000000000000000000000003");
const GROUP_ID = new mongoose.Types.ObjectId("000000000000000000000010");

// Generate random unusable password for teammate accounts
function randomPassword() {
  return bcrypt.hashSync(Math.random().toString(36), 10);
}

/**
 * Ensures demo data exists (idempotent)
 * Returns the demo user
 */
export async function ensureDemoData() {
  // Upsert demo user
  const demoUser = await User.findOneAndUpdate(
    { _id: DEMO_USER_ID },
    {
      $setOnInsert: {
        _id: DEMO_USER_ID,
        name: "Demo User",
        email: "demo@cashdash.app",
        passwordHash: await bcrypt.hash("DemoPass123!", 10),
        currency: "NPR",
        walletBalanceMinor: 500000, // 5000.00 NPR
        isDemo: true
      }
    },
    { upsert: true, new: true }
  );

  // Upsert teammate accounts
  await User.findOneAndUpdate(
    { _id: AARAV_USER_ID },
    {
      $setOnInsert: {
        _id: AARAV_USER_ID,
        name: "Aarav Sharma",
        email: "aarav@cashdash.app",
        passwordHash: randomPassword(),
        currency: "NPR",
        walletBalanceMinor: 0,
        isDemo: true
      }
    },
    { upsert: true }
  );

  await User.findOneAndUpdate(
    { _id: PRIYA_USER_ID },
    {
      $setOnInsert: {
        _id: PRIYA_USER_ID,
        name: "Priya Thapa",
        email: "priya@cashdash.app",
        passwordHash: randomPassword(),
        currency: "NPR",
        walletBalanceMinor: 0,
        isDemo: true
      }
    },
    { upsert: true }
  );

  // Seed personal expenses for demo user (relative dates)
  const now = new Date();
  const personalExpenses = [
    { category: "Food", description: "Lunch at Bhat Bhateni", amountMinor: 35000, paymentMode: "WALLET", daysAgo: 1 },
    { category: "Transport", description: "Taxi to Thamel", amountMinor: 25000, paymentMode: "CASH", daysAgo: 2 },
    { category: "Groceries", description: "Weekly groceries", amountMinor: 120000, paymentMode: "CARD", daysAgo: 3 },
    { category: "Entertainment", description: "Movie tickets", amountMinor: 80000, paymentMode: "UPI", daysAgo: 5 },
    { category: "Bills", description: "Electricity bill", amountMinor: 150000, paymentMode: "BANK", daysAgo: 7 },
    { category: "Food", description: "Coffee at Himalayan Java", amountMinor: 45000, paymentMode: "WALLET", daysAgo: 0 }
  ];

  for (const exp of personalExpenses) {
    const date = new Date(now);
    date.setDate(date.getDate() - exp.daysAgo);

    await PersonalExpense.findOneAndUpdate(
      { userId: DEMO_USER_ID, description: exp.description },
      {
        $setOnInsert: {
          userId: DEMO_USER_ID,
          amountMinor: exp.amountMinor,
          category: exp.category,
          description: exp.description,
          paymentMode: exp.paymentMode,
          date
        }
      },
      { upsert: true }
    );
  }

  // Seed group
  await Group.findOneAndUpdate(
    { _id: GROUP_ID },
    {
      $setOnInsert: {
        _id: GROUP_ID,
        name: "Pokhara Weekend Trip",
        description: "Trip expenses for the Pokhara getaway",
        currency: "NPR",
        createdBy: DEMO_USER_ID,
        members: [DEMO_USER_ID, AARAV_USER_ID, PRIYA_USER_ID]
      }
    },
    { upsert: true }
  );

  // Seed group expenses
  const groupExpenses = [
    {
      description: "Hotel Booking",
      amountMinor: 900000, // 9000 NPR
      payerId: DEMO_USER_ID,
      splitType: "EQUAL",
      splits: [
        { userId: DEMO_USER_ID, amountMinor: 300000 },
        { userId: AARAV_USER_ID, amountMinor: 300000 },
        { userId: PRIYA_USER_ID, amountMinor: 300000 }
      ],
      daysAgo: 10
    },
    {
      description: "Dinner at Lakeside",
      amountMinor: 450000, // 4500 NPR
      payerId: AARAV_USER_ID,
      splitType: "EXACT",
      splits: [
        { userId: DEMO_USER_ID, amountMinor: 180000 },
        { userId: AARAV_USER_ID, amountMinor: 150000 },
        { userId: PRIYA_USER_ID, amountMinor: 120000 }
      ],
      daysAgo: 9
    },
    {
      description: "Paragliding",
      amountMinor: 1500000, // 15000 NPR
      payerId: PRIYA_USER_ID,
      splitType: "PERCENT",
      splits: [
        { userId: DEMO_USER_ID, amountMinor: 500000, percent: 33.33 },
        { userId: AARAV_USER_ID, amountMinor: 500000, percent: 33.33 },
        { userId: PRIYA_USER_ID, amountMinor: 500000, percent: 33.34 }
      ],
      daysAgo: 8
    }
  ];

  for (const gExp of groupExpenses) {
    const date = new Date(now);
    date.setDate(date.getDate() - gExp.daysAgo);

    await GroupExpense.findOneAndUpdate(
      { groupId: GROUP_ID, description: gExp.description },
      {
        $setOnInsert: {
          groupId: GROUP_ID,
          payerId: gExp.payerId,
          description: gExp.description,
          amountMinor: gExp.amountMinor,
          splitType: gExp.splitType,
          splits: gExp.splits,
          date
        }
      },
      { upsert: true }
    );
  }

  // Seed one partial settlement
  await Settlement.findOneAndUpdate(
    { groupId: GROUP_ID, fromUserId: DEMO_USER_ID, toUserId: PRIYA_USER_ID },
    {
      $setOnInsert: {
        groupId: GROUP_ID,
        fromUserId: DEMO_USER_ID,
        toUserId: PRIYA_USER_ID,
        amountMinor: 100000, // 1000 NPR partial payment
        note: "Partial settlement via eSewa"
      }
    },
    { upsert: true }
  );

  return demoUser;
}

// Export IDs for testing
export const DEMO_IDS = {
  DEMO_USER_ID,
  AARAV_USER_ID,
  PRIYA_USER_ID,
  GROUP_ID
};
