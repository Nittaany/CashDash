import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import PersonalExpense from "../models/PersonalExpense.js";
import Group from "../models/Group.js";
import GroupExpense from "../models/GroupExpense.js";

/**
 * Creates an ephemeral demo user with sample data
 * All documents expire in 2 hours via TTL index
 * Returns the demo user
 */
export async function createEphemeralDemoUser() {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
  const randomSuffix = crypto.randomBytes(8).toString("hex");

  // Create ephemeral demo user
  const demoUser = await User.create({
    name: "Demo User",
    email: `demo-${randomSuffix}@cashdash.app`,
    passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10),
    currency: "NPR",
    walletBalanceMinor: 500000, // 5000.00 NPR
    isDemo: true,
    expiresAt
  });

  // Create ephemeral teammates
  const teammate1 = await User.create({
    name: "Aarav Sharma",
    email: `aarav-${randomSuffix}@cashdash.app`,
    passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10),
    currency: "NPR",
    walletBalanceMinor: 0,
    isDemo: true,
    expiresAt
  });

  const teammate2 = await User.create({
    name: "Priya Thapa",
    email: `priya-${randomSuffix}@cashdash.app`,
    passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10),
    currency: "NPR",
    walletBalanceMinor: 0,
    isDemo: true,
    expiresAt
  });

  // Seed personal expenses (relative dates) - all with expiresAt
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

    await PersonalExpense.create({
      userId: demoUser._id,
      amountMinor: exp.amountMinor,
      category: exp.category,
      description: exp.description,
      paymentMode: exp.paymentMode,
      date,
      expiresAt // TTL cleanup
    });
  }

  // Create demo group with expiresAt
  const group = await Group.create({
    name: "Pokhara Weekend Trip",
    description: "Trip expenses for the Pokhara getaway",
    currency: "NPR",
    createdBy: demoUser._id,
    members: [demoUser._id, teammate1._id, teammate2._id],
    expiresAt // TTL cleanup
  });

  // Seed group expenses - all with expiresAt
  const groupExpenses = [
    {
      description: "Hotel Booking",
      amountMinor: 900000,
      payerId: demoUser._id,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: 300000 },
        { userId: teammate1._id, amountMinor: 300000 },
        { userId: teammate2._id, amountMinor: 300000 }
      ],
      daysAgo: 10
    },
    {
      description: "Dinner at Lakeside",
      amountMinor: 450000,
      payerId: teammate1._id,
      splitType: "EXACT",
      splits: [
        { userId: demoUser._id, amountMinor: 180000 },
        { userId: teammate1._id, amountMinor: 150000 },
        { userId: teammate2._id, amountMinor: 120000 }
      ],
      daysAgo: 9
    },
    {
      description: "Paragliding",
      amountMinor: 1500000,
      payerId: teammate2._id,
      splitType: "PERCENT",
      splits: [
        { userId: demoUser._id, amountMinor: 500000, percent: 33.33 },
        { userId: teammate1._id, amountMinor: 500000, percent: 33.33 },
        { userId: teammate2._id, amountMinor: 500000, percent: 33.34 }
      ],
      daysAgo: 8
    }
  ];

  for (const gExp of groupExpenses) {
    const date = new Date(now);
    date.setDate(date.getDate() - gExp.daysAgo);

    await GroupExpense.create({
      groupId: group._id,
      payerId: gExp.payerId,
      description: gExp.description,
      amountMinor: gExp.amountMinor,
      splitType: gExp.splitType,
      splits: gExp.splits,
      date,
      expiresAt // TTL cleanup
    });
  }

  return demoUser;
}

// Legacy function for backward compatibility with seed script
export async function ensureDemoData() {
  return createEphemeralDemoUser();
}
