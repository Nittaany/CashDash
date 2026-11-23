import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import PersonalExpense from "../models/PersonalExpense.js";
import Group from "../models/Group.js";
import GroupExpense from "../models/GroupExpense.js";
import Settlement from "../models/Settlement.js";

/**
 * Creates an ephemeral demo user with rich sample data
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
    walletBalanceMinor: 2500000, // 25,000.00 NPR
    isDemo: true,
    isEmailVerified: true,
    expiresAt
  });

  // Create ephemeral teammates (9 people for group variety)
  const teammates = await Promise.all([
    User.create({
      name: "Aarav Sharma",
      email: `aarav-${randomSuffix}@cashdash.app`,
      passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10),
      currency: "NPR",
      paymentHandle: "aarav@esewa",
      isDemo: true,
      isEmailVerified: true,
      expiresAt
    }),
    User.create({
      name: "Priya Thapa",
      email: `priya-${randomSuffix}@cashdash.app`,
      passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10),
      currency: "NPR",
      paymentHandle: "priya@khalti",
      isDemo: true,
      isEmailVerified: true,
      expiresAt
    }),
    User.create({
      name: "Rohan Gurung",
      email: `rohan-${randomSuffix}@cashdash.app`,
      passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10),
      currency: "NPR",
      isDemo: true,
      isEmailVerified: true,
      expiresAt
    }),
    User.create({
      name: "Sita Rai",
      email: `sita-${randomSuffix}@cashdash.app`,
      passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10),
      currency: "NPR",
      isDemo: true,
      isEmailVerified: true,
      expiresAt
    }),
    User.create({
      name: "Bikash Tamang",
      email: `bikash-${randomSuffix}@cashdash.app`,
      passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10),
      currency: "INR",
      paymentHandle: "bikash@upi",
      isDemo: true,
      isEmailVerified: true,
      expiresAt
    }),
    User.create({
      name: "Anita Shrestha",
      email: `anita-${randomSuffix}@cashdash.app`,
      passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10),
      currency: "NPR",
      isDemo: true,
      isEmailVerified: true,
      expiresAt
    }),
    User.create({
      name: "Kiran Magar",
      email: `kiran-${randomSuffix}@cashdash.app`,
      passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10),
      currency: "USD",
      isDemo: true,
      isEmailVerified: true,
      expiresAt
    }),
    User.create({
      name: "Maya Lama",
      email: `maya-${randomSuffix}@cashdash.app`,
      passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10),
      currency: "NPR",
      isDemo: true,
      isEmailVerified: true,
      expiresAt
    }),
    User.create({
      name: "Dev Karki",
      email: `dev-${randomSuffix}@cashdash.app`,
      passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10),
      currency: "NPR",
      isDemo: true,
      isEmailVerified: true,
      expiresAt
    })
  ]);

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSONAL EXPENSES (25 expenses across 3 months, diverse categories)
  // ═══════════════════════════════════════════════════════════════════════════
  const personalExpenses = [
    // This week
    { category: "Food", description: "Coffee at Himalayan Java", amountMinor: 45000, paymentMode: "WALLET", daysAgo: 0 },
    { category: "Transport", description: "Pathao to office", amountMinor: 15000, paymentMode: "WALLET", daysAgo: 0 },
    { category: "Food", description: "Lunch at Bhat Bhateni food court", amountMinor: 35000, paymentMode: "WALLET", daysAgo: 1 },
    { category: "Shopping", description: "Phone charger from Daraz", amountMinor: 89900, paymentMode: "CARD", daysAgo: 2 },
    { category: "Transport", description: "Taxi to Thamel", amountMinor: 25000, paymentMode: "CASH", daysAgo: 2 },
    { category: "Entertainment", description: "Netflix subscription", amountMinor: 129900, paymentMode: "CARD", daysAgo: 3 },
    { category: "Food", description: "Dinner at Fire & Ice", amountMinor: 180000, paymentMode: "UPI", daysAgo: 4 },
    { category: "Groceries", description: "Weekly groceries from Salesberry", amountMinor: 320000, paymentMode: "CARD", daysAgo: 5 },
    
    // Last week
    { category: "Bills", description: "Electricity bill", amountMinor: 150000, paymentMode: "BANK", daysAgo: 7 },
    { category: "Food", description: "Momo at local cafe", amountMinor: 25000, paymentMode: "CASH", daysAgo: 8 },
    { category: "Transport", description: "Bus pass monthly", amountMinor: 300000, paymentMode: "WALLET", daysAgo: 9 },
    { category: "Health", description: "Gym membership", amountMinor: 500000, paymentMode: "BANK", daysAgo: 10 },
    { category: "Entertainment", description: "Movie tickets - QFX", amountMinor: 160000, paymentMode: "UPI", daysAgo: 12 },
    
    // 2-3 weeks ago
    { category: "Bills", description: "Internet - Vianet", amountMinor: 180000, paymentMode: "BANK", daysAgo: 15 },
    { category: "Shopping", description: "Jacket from Civil Mall", amountMinor: 450000, paymentMode: "CARD", daysAgo: 16 },
    { category: "Food", description: "Birthday dinner treat", amountMinor: 520000, paymentMode: "CARD", daysAgo: 18 },
    { category: "Transport", description: "Weekend trip fuel", amountMinor: 200000, paymentMode: "CASH", daysAgo: 20 },
    { category: "Groceries", description: "Monthly stock from BigMart", amountMinor: 450000, paymentMode: "CARD", daysAgo: 21 },
    
    // Last month
    { category: "Bills", description: "Mobile recharge - NTC", amountMinor: 100000, paymentMode: "WALLET", daysAgo: 30 },
    { category: "Health", description: "Doctor visit", amountMinor: 150000, paymentMode: "CASH", daysAgo: 32 },
    { category: "Entertainment", description: "Spotify annual", amountMinor: 199900, paymentMode: "CARD", daysAgo: 35 },
    { category: "Food", description: "Team lunch at Momo Magic", amountMinor: 85000, paymentMode: "WALLET", daysAgo: 38 },
    
    // 2 months ago
    { category: "Shopping", description: "Books from Pilgrims", amountMinor: 180000, paymentMode: "CASH", daysAgo: 50 },
    { category: "Bills", description: "Rent advance partial", amountMinor: 2000000, paymentMode: "BANK", daysAgo: 55 },
    { category: "Transport", description: "Flight to Pokhara", amountMinor: 650000, paymentMode: "CARD", daysAgo: 60 }
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
      expiresAt
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 1: Pokhara Weekend Trip (NPR) - 3 members, mixed splits + settlement
  // ═══════════════════════════════════════════════════════════════════════════
  const pokharaGroup = await Group.create({
    name: "Pokhara Weekend Trip",
    description: "Trip expenses for the Pokhara getaway",
    currency: "NPR",
    createdBy: demoUser._id,
    members: [demoUser._id, teammates[0]._id, teammates[1]._id],
    expiresAt
  });

  const pokharaExpenses = [
    {
      description: "Hotel Barahi booking",
      amountMinor: 1200000, // 12,000
      payerId: demoUser._id,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: 400000 },
        { userId: teammates[0]._id, amountMinor: 400000 },
        { userId: teammates[1]._id, amountMinor: 400000 }
      ],
      daysAgo: 15
    },
    {
      description: "Dinner at Lakeside",
      amountMinor: 450000,
      payerId: teammates[0]._id,
      splitType: "EXACT",
      splits: [
        { userId: demoUser._id, amountMinor: 180000 },
        { userId: teammates[0]._id, amountMinor: 150000 },
        { userId: teammates[1]._id, amountMinor: 120000 }
      ],
      daysAgo: 14
    },
    {
      description: "Paragliding adventure",
      amountMinor: 2100000, // 21,000
      payerId: teammates[1]._id,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: 700000 },
        { userId: teammates[0]._id, amountMinor: 700000 },
        { userId: teammates[1]._id, amountMinor: 700000 }
      ],
      daysAgo: 14
    },
    {
      description: "Boat ride at Fewa Lake",
      amountMinor: 150000,
      payerId: demoUser._id,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: 50000 },
        { userId: teammates[0]._id, amountMinor: 50000 },
        { userId: teammates[1]._id, amountMinor: 50000 }
      ],
      daysAgo: 13
    },
    {
      description: "Taxi to Peace Pagoda",
      amountMinor: 180000,
      payerId: teammates[0]._id,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: 60000 },
        { userId: teammates[0]._id, amountMinor: 60000 },
        { userId: teammates[1]._id, amountMinor: 60000 }
      ],
      daysAgo: 13
    }
  ];

  for (const gExp of pokharaExpenses) {
    const date = new Date(now);
    date.setDate(date.getDate() - gExp.daysAgo);
    await GroupExpense.create({
      groupId: pokharaGroup._id,
      payerId: gExp.payerId,
      description: gExp.description,
      amountMinor: gExp.amountMinor,
      splitType: gExp.splitType,
      splits: gExp.splits,
      date,
      expiresAt
    });
  }

  // Add a partial settlement
  const settlementDate = new Date(now);
  settlementDate.setDate(settlementDate.getDate() - 10);
  await Settlement.create({
    groupId: pokharaGroup._id,
    fromUserId: teammates[0]._id,
    toUserId: demoUser._id,
    amountMinor: 300000, // 3,000 partial payment
    note: "Partial payment via eSewa",
    settledAt: settlementDate,
    expiresAt
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 2: Kathmandu Flatmates (NPR) - 4 members, recurring expenses
  // ═══════════════════════════════════════════════════════════════════════════
  const flatmatesGroup = await Group.create({
    name: "Kathmandu Flatmates",
    description: "Shared apartment expenses",
    currency: "NPR",
    createdBy: demoUser._id,
    members: [demoUser._id, teammates[2]._id, teammates[3]._id, teammates[5]._id],
    expiresAt
  });

  const flatmatesExpenses = [
    {
      description: "November Rent",
      amountMinor: 6000000, // 60,000
      payerId: demoUser._id,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: 1500000 },
        { userId: teammates[2]._id, amountMinor: 1500000 },
        { userId: teammates[3]._id, amountMinor: 1500000 },
        { userId: teammates[5]._id, amountMinor: 1500000 }
      ],
      daysAgo: 5
    },
    {
      description: "Vianet Internet",
      amountMinor: 180000,
      payerId: teammates[2]._id,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: 45000 },
        { userId: teammates[2]._id, amountMinor: 45000 },
        { userId: teammates[3]._id, amountMinor: 45000 },
        { userId: teammates[5]._id, amountMinor: 45000 }
      ],
      daysAgo: 4
    },
    {
      description: "Electricity bill",
      amountMinor: 350000,
      payerId: teammates[3]._id,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: 87500 },
        { userId: teammates[2]._id, amountMinor: 87500 },
        { userId: teammates[3]._id, amountMinor: 87500 },
        { userId: teammates[5]._id, amountMinor: 87500 }
      ],
      daysAgo: 3
    },
    {
      description: "Cleaning supplies",
      amountMinor: 85000,
      payerId: teammates[5]._id,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: 21250 },
        { userId: teammates[2]._id, amountMinor: 21250 },
        { userId: teammates[3]._id, amountMinor: 21250 },
        { userId: teammates[5]._id, amountMinor: 21250 }
      ],
      daysAgo: 2
    },
    {
      description: "Water tanker",
      amountMinor: 200000,
      payerId: demoUser._id,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: 50000 },
        { userId: teammates[2]._id, amountMinor: 50000 },
        { userId: teammates[3]._id, amountMinor: 50000 },
        { userId: teammates[5]._id, amountMinor: 50000 }
      ],
      daysAgo: 1
    }
  ];

  for (const gExp of flatmatesExpenses) {
    const date = new Date(now);
    date.setDate(date.getDate() - gExp.daysAgo);
    await GroupExpense.create({
      groupId: flatmatesGroup._id,
      payerId: gExp.payerId,
      description: gExp.description,
      amountMinor: gExp.amountMinor,
      splitType: gExp.splitType,
      splits: gExp.splits,
      date,
      expiresAt
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 3: Office Lunch Club (NPR) - 5 members
  // ═══════════════════════════════════════════════════════════════════════════
  const lunchGroup = await Group.create({
    name: "Office Lunch Club",
    description: "Daily lunch rotations",
    currency: "NPR",
    createdBy: demoUser._id,
    members: [demoUser._id, teammates[0]._id, teammates[2]._id, teammates[5]._id, teammates[7]._id],
    expiresAt
  });

  const lunchExpenses = [
    { description: "Monday - Thakali Kitchen", amountMinor: 125000, payerId: demoUser._id, daysAgo: 4 },
    { description: "Tuesday - Momo Cave", amountMinor: 95000, payerId: teammates[0]._id, daysAgo: 3 },
    { description: "Wednesday - OR2K", amountMinor: 180000, payerId: teammates[2]._id, daysAgo: 2 },
    { description: "Thursday - Nanglo Bakery", amountMinor: 110000, payerId: teammates[5]._id, daysAgo: 1 },
    { description: "Friday - Roadhouse Cafe", amountMinor: 220000, payerId: teammates[7]._id, daysAgo: 0 }
  ];

  for (const exp of lunchExpenses) {
    const date = new Date(now);
    date.setDate(date.getDate() - exp.daysAgo);
    const perPerson = Math.floor(exp.amountMinor / 5);
    const remainder = exp.amountMinor - perPerson * 5;
    await GroupExpense.create({
      groupId: lunchGroup._id,
      payerId: exp.payerId,
      description: exp.description,
      amountMinor: exp.amountMinor,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: perPerson + (remainder > 0 ? 1 : 0) },
        { userId: teammates[0]._id, amountMinor: perPerson + (remainder > 1 ? 1 : 0) },
        { userId: teammates[2]._id, amountMinor: perPerson + (remainder > 2 ? 1 : 0) },
        { userId: teammates[5]._id, amountMinor: perPerson + (remainder > 3 ? 1 : 0) },
        { userId: teammates[7]._id, amountMinor: perPerson }
      ],
      date,
      expiresAt
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 4: Remote Team Offsite (USD) - 3 members, multi-currency demo
  // ═══════════════════════════════════════════════════════════════════════════
  const offsiteGroup = await Group.create({
    name: "Remote Team Offsite",
    description: "Annual team meetup expenses",
    currency: "USD",
    createdBy: demoUser._id,
    members: [demoUser._id, teammates[6]._id, teammates[4]._id],
    expiresAt
  });

  const offsiteExpenses = [
    {
      description: "Airbnb booking",
      amountMinor: 45000, // $450
      payerId: teammates[6]._id,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: 15000 },
        { userId: teammates[6]._id, amountMinor: 15000 },
        { userId: teammates[4]._id, amountMinor: 15000 }
      ],
      daysAgo: 25
    },
    {
      description: "Team dinner at steakhouse",
      amountMinor: 28500, // $285
      payerId: demoUser._id,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: 9500 },
        { userId: teammates[6]._id, amountMinor: 9500 },
        { userId: teammates[4]._id, amountMinor: 9500 }
      ],
      daysAgo: 24
    },
    {
      description: "Uber rides",
      amountMinor: 12000, // $120
      payerId: teammates[4]._id,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: 4000 },
        { userId: teammates[6]._id, amountMinor: 4000 },
        { userId: teammates[4]._id, amountMinor: 4000 }
      ],
      daysAgo: 23
    }
  ];

  for (const gExp of offsiteExpenses) {
    const date = new Date(now);
    date.setDate(date.getDate() - gExp.daysAgo);
    await GroupExpense.create({
      groupId: offsiteGroup._id,
      payerId: gExp.payerId,
      description: gExp.description,
      amountMinor: gExp.amountMinor,
      splitType: gExp.splitType,
      splits: gExp.splits,
      date,
      expiresAt
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 5: Wedding Gift Pool (INR) - 4 members
  // ═══════════════════════════════════════════════════════════════════════════
  const weddingGroup = await Group.create({
    name: "Rahul's Wedding Gift",
    description: "Pooling money for wedding gift",
    currency: "INR",
    createdBy: demoUser._id,
    members: [demoUser._id, teammates[4]._id, teammates[0]._id, teammates[1]._id],
    expiresAt
  });

  const weddingExpense = {
    description: "Gift contribution",
    amountMinor: 2000000, // ₹20,000
    payerId: teammates[4]._id,
    splitType: "EQUAL",
    splits: [
      { userId: demoUser._id, amountMinor: 500000 },
      { userId: teammates[4]._id, amountMinor: 500000 },
      { userId: teammates[0]._id, amountMinor: 500000 },
      { userId: teammates[1]._id, amountMinor: 500000 }
    ],
    daysAgo: 8
  };

  const weddingDate = new Date(now);
  weddingDate.setDate(weddingDate.getDate() - weddingExpense.daysAgo);
  await GroupExpense.create({
    groupId: weddingGroup._id,
    payerId: weddingExpense.payerId,
    description: weddingExpense.description,
    amountMinor: weddingExpense.amountMinor,
    splitType: weddingExpense.splitType,
    splits: weddingExpense.splits,
    date: weddingDate,
    expiresAt
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 6: Hiking Club (NPR) - 6 members
  // ═══════════════════════════════════════════════════════════════════════════
  const hikingGroup = await Group.create({
    name: "Weekend Hikers",
    description: "Hiking trip expenses",
    currency: "NPR",
    createdBy: demoUser._id,
    members: [demoUser._id, teammates[0]._id, teammates[2]._id, teammates[3]._id, teammates[7]._id, teammates[8]._id],
    expiresAt
  });

  const hikingExpenses = [
    {
      description: "Shivapuri entry permits",
      amountMinor: 180000, // 6 permits
      payerId: demoUser._id,
      daysAgo: 6
    },
    {
      description: "Trail snacks & water",
      amountMinor: 90000,
      payerId: teammates[3]._id,
      daysAgo: 6
    },
    {
      description: "Transport to trailhead",
      amountMinor: 240000,
      payerId: teammates[8]._id,
      daysAgo: 6
    }
  ];

  for (const exp of hikingExpenses) {
    const date = new Date(now);
    date.setDate(date.getDate() - exp.daysAgo);
    const perPerson = Math.floor(exp.amountMinor / 6);
    await GroupExpense.create({
      groupId: hikingGroup._id,
      payerId: exp.payerId,
      description: exp.description,
      amountMinor: exp.amountMinor,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: perPerson },
        { userId: teammates[0]._id, amountMinor: perPerson },
        { userId: teammates[2]._id, amountMinor: perPerson },
        { userId: teammates[3]._id, amountMinor: perPerson },
        { userId: teammates[7]._id, amountMinor: perPerson },
        { userId: teammates[8]._id, amountMinor: perPerson }
      ],
      date,
      expiresAt
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 7: Book Club (NPR) - 3 members
  // ═══════════════════════════════════════════════════════════════════════════
  const bookGroup = await Group.create({
    name: "Book Club",
    description: "Shared book purchases",
    currency: "NPR",
    createdBy: teammates[1]._id,
    members: [demoUser._id, teammates[1]._id, teammates[5]._id],
    expiresAt
  });

  const bookExpenses = [
    { description: "Atomic Habits", amountMinor: 95000, payerId: teammates[1]._id, daysAgo: 20 },
    { description: "Sapiens", amountMinor: 120000, payerId: demoUser._id, daysAgo: 15 },
    { description: "The Psychology of Money", amountMinor: 85000, payerId: teammates[5]._id, daysAgo: 7 }
  ];

  for (const exp of bookExpenses) {
    const date = new Date(now);
    date.setDate(date.getDate() - exp.daysAgo);
    const perPerson = Math.floor(exp.amountMinor / 3);
    await GroupExpense.create({
      groupId: bookGroup._id,
      payerId: exp.payerId,
      description: exp.description,
      amountMinor: exp.amountMinor,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: perPerson },
        { userId: teammates[1]._id, amountMinor: perPerson },
        { userId: teammates[5]._id, amountMinor: perPerson }
      ],
      date,
      expiresAt
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 8: Birthday Party (NPR) - 5 members, with percent splits
  // ═══════════════════════════════════════════════════════════════════════════
  const birthdayGroup = await Group.create({
    name: "Priya's Birthday",
    description: "Surprise party expenses",
    currency: "NPR",
    createdBy: demoUser._id,
    members: [demoUser._id, teammates[0]._id, teammates[2]._id, teammates[3]._id, teammates[5]._id],
    expiresAt
  });

  const birthdayExpenses = [
    {
      description: "Cake from Bakery Cafe",
      amountMinor: 350000,
      payerId: demoUser._id,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: 70000 },
        { userId: teammates[0]._id, amountMinor: 70000 },
        { userId: teammates[2]._id, amountMinor: 70000 },
        { userId: teammates[3]._id, amountMinor: 70000 },
        { userId: teammates[5]._id, amountMinor: 70000 }
      ],
      daysAgo: 11
    },
    {
      description: "Decorations",
      amountMinor: 150000,
      payerId: teammates[0]._id,
      splitType: "PERCENT",
      splits: [
        { userId: demoUser._id, amountMinor: 45000, percent: 30 },
        { userId: teammates[0]._id, amountMinor: 30000, percent: 20 },
        { userId: teammates[2]._id, amountMinor: 30000, percent: 20 },
        { userId: teammates[3]._id, amountMinor: 22500, percent: 15 },
        { userId: teammates[5]._id, amountMinor: 22500, percent: 15 }
      ],
      daysAgo: 11
    },
    {
      description: "Venue booking",
      amountMinor: 500000,
      payerId: teammates[2]._id,
      splitType: "EQUAL",
      splits: [
        { userId: demoUser._id, amountMinor: 100000 },
        { userId: teammates[0]._id, amountMinor: 100000 },
        { userId: teammates[2]._id, amountMinor: 100000 },
        { userId: teammates[3]._id, amountMinor: 100000 },
        { userId: teammates[5]._id, amountMinor: 100000 }
      ],
      daysAgo: 11
    }
  ];

  for (const gExp of birthdayExpenses) {
    const date = new Date(now);
    date.setDate(date.getDate() - gExp.daysAgo);
    await GroupExpense.create({
      groupId: birthdayGroup._id,
      payerId: gExp.payerId,
      description: gExp.description,
      amountMinor: gExp.amountMinor,
      splitType: gExp.splitType,
      splits: gExp.splits,
      date,
      expiresAt
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 9: Gaming Setup (NPR) - 2 members only
  // ═══════════════════════════════════════════════════════════════════════════
  const gamingGroup = await Group.create({
    name: "Gaming Setup",
    description: "Shared gaming equipment",
    currency: "NPR",
    createdBy: teammates[8]._id,
    members: [demoUser._id, teammates[8]._id],
    expiresAt
  });

  const gamingExpense = {
    description: "PS5 controller",
    amountMinor: 850000,
    payerId: teammates[8]._id,
    daysAgo: 3
  };

  const gamingDate = new Date(now);
  gamingDate.setDate(gamingDate.getDate() - gamingExpense.daysAgo);
  await GroupExpense.create({
    groupId: gamingGroup._id,
    payerId: gamingExpense.payerId,
    description: gamingExpense.description,
    amountMinor: gamingExpense.amountMinor,
    splitType: "EQUAL",
    splits: [
      { userId: demoUser._id, amountMinor: 425000 },
      { userId: teammates[8]._id, amountMinor: 425000 }
    ],
    date: gamingDate,
    expiresAt
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 10: Empty Group (for testing)
  // ═══════════════════════════════════════════════════════════════════════════
  await Group.create({
    name: "New Year Party Planning",
    description: "Expenses for upcoming party - nothing added yet",
    currency: "NPR",
    createdBy: demoUser._id,
    members: [demoUser._id, teammates[0]._id, teammates[1]._id, teammates[2]._id],
    expiresAt
  });

  return demoUser;
}

// Legacy function for backward compatibility
export async function ensureDemoData() {
  return createEphemeralDemoUser();
}
