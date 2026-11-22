import { describe, expect, it } from "vitest";
import { simplifyDebts } from "../../src/services/debtSimplifier.js";

describe("simplifyDebts", () => {
  it("cancels mutual debts", () => {
    const transfers = simplifyDebts({
      expenses: [
        { payerId: "B", splits: [{ userId: "A", amountMinor: 500 }] },
        { payerId: "A", splits: [{ userId: "B", amountMinor: 500 }] }
      ],
      settlements: []
    });

    expect(transfers).toEqual([]);
  });

  it("simplifies a three-person transitive debt", () => {
    const transfers = simplifyDebts({
      expenses: [
        { payerId: "B", splits: [{ userId: "A", amountMinor: 500 }] },
        { payerId: "C", splits: [{ userId: "B", amountMinor: 500 }] }
      ],
      settlements: []
    });

    expect(transfers).toEqual([
      { fromUserId: "A", toUserId: "C", amountMinor: 500 }
    ]);
  });

  it("deducts a partial settlement", () => {
    const transfers = simplifyDebts({
      expenses: [
        { payerId: "B", splits: [{ userId: "A", amountMinor: 500 }] }
      ],
      settlements: [
        { fromUserId: "A", toUserId: "B", amountMinor: 200 }
      ]
    });

    expect(transfers).toEqual([
      { fromUserId: "A", toUserId: "B", amountMinor: 300 }
    ]);
  });

  it("conserves the total net balance", () => {
    const expenses = [
      { payerId: "A", splits: [{ userId: "B", amountMinor: 800 }] },
      { payerId: "B", splits: [{ userId: "C", amountMinor: 300 }] },
      { payerId: "C", splits: [{ userId: "A", amountMinor: 200 }] }
    ];
    const settlements = [
      { fromUserId: "B", toUserId: "A", amountMinor: 100 }
    ];

    const transfers = simplifyDebts({ expenses, settlements });
    const net = new Map();

    for (const expense of expenses) {
      for (const split of expense.splits) {
        if (split.userId === expense.payerId) continue;
        net.set(split.userId, (net.get(split.userId) ?? 0) - split.amountMinor);
        net.set(expense.payerId, (net.get(expense.payerId) ?? 0) + split.amountMinor);
      }
    }
    for (const settlement of settlements) {
      net.set(settlement.fromUserId, (net.get(settlement.fromUserId) ?? 0) + settlement.amountMinor);
      net.set(settlement.toUserId, (net.get(settlement.toUserId) ?? 0) - settlement.amountMinor);
    }

    const expectedNet = [...net.values()].reduce((sum, amount) => sum + amount, 0);
    expect(expectedNet).toBe(0);
    expect(transfers.every((transfer) => transfer.amountMinor > 0)).toBe(true);
    expect(transfers.every((transfer) => transfer.fromUserId !== transfer.toUserId)).toBe(true);
  });

  // Additional coverage tests
  it("handles empty expenses and settlements", () => {
    const transfers = simplifyDebts({
      expenses: [],
      settlements: []
    });
    expect(transfers).toEqual([]);
  });

  it("handles multiple debtors owing one creditor", () => {
    const transfers = simplifyDebts({
      expenses: [
        { payerId: "A", splits: [
          { userId: "B", amountMinor: 300 },
          { userId: "C", amountMinor: 200 }
        ]}
      ],
      settlements: []
    });

    expect(transfers.length).toBe(2);
    expect(transfers.find((t) => t.fromUserId === "B")).toEqual({
      fromUserId: "B", toUserId: "A", amountMinor: 300
    });
    expect(transfers.find((t) => t.fromUserId === "C")).toEqual({
      fromUserId: "C", toUserId: "A", amountMinor: 200
    });
  });

  it("handles one debtor owing multiple creditors", () => {
    const transfers = simplifyDebts({
      expenses: [
        { payerId: "A", splits: [{ userId: "C", amountMinor: 400 }] },
        { payerId: "B", splits: [{ userId: "C", amountMinor: 300 }] }
      ],
      settlements: []
    });

    // C owes 400 to A and 300 to B
    expect(transfers.length).toBe(2);
    expect(transfers.reduce((s, t) => s + t.amountMinor, 0)).toBe(700);
  });

  it("handles payer split to self (no debt created)", () => {
    const transfers = simplifyDebts({
      expenses: [
        { payerId: "A", splits: [
          { userId: "A", amountMinor: 500 }, // Self split
          { userId: "B", amountMinor: 500 }
        ]}
      ],
      settlements: []
    });

    expect(transfers).toEqual([
      { fromUserId: "B", toUserId: "A", amountMinor: 500 }
    ]);
  });

  it("handles settlement that fully clears debt", () => {
    const transfers = simplifyDebts({
      expenses: [
        { payerId: "A", splits: [{ userId: "B", amountMinor: 1000 }] }
      ],
      settlements: [
        { fromUserId: "B", toUserId: "A", amountMinor: 1000 }
      ]
    });

    expect(transfers).toEqual([]);
  });

  it("handles multiple settlements", () => {
    const transfers = simplifyDebts({
      expenses: [
        { payerId: "A", splits: [{ userId: "B", amountMinor: 1000 }] }
      ],
      settlements: [
        { fromUserId: "B", toUserId: "A", amountMinor: 300 },
        { fromUserId: "B", toUserId: "A", amountMinor: 200 }
      ]
    });

    expect(transfers).toEqual([
      { fromUserId: "B", toUserId: "A", amountMinor: 500 }
    ]);
  });

  it("handles complex multi-person scenario", () => {
    const transfers = simplifyDebts({
      expenses: [
        { payerId: "A", splits: [
          { userId: "B", amountMinor: 100 },
          { userId: "C", amountMinor: 100 },
          { userId: "D", amountMinor: 100 }
        ]},
        { payerId: "B", splits: [
          { userId: "A", amountMinor: 50 },
          { userId: "C", amountMinor: 50 }
        ]}
      ],
      settlements: []
    });

    // Verify net balances sum to 0
    const netFromTransfers = new Map();
    for (const t of transfers) {
      netFromTransfers.set(t.fromUserId, (netFromTransfers.get(t.fromUserId) ?? 0) - t.amountMinor);
      netFromTransfers.set(t.toUserId, (netFromTransfers.get(t.toUserId) ?? 0) + t.amountMinor);
    }
    const sum = [...netFromTransfers.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);
  });

  // Error handling tests
  it("throws if expenses is not an array", () => {
    expect(() => simplifyDebts({ expenses: "bad", settlements: [] }))
      .toThrow(/must be arrays/i);
  });

  it("throws if settlements is not an array", () => {
    expect(() => simplifyDebts({ expenses: [], settlements: "bad" }))
      .toThrow(/must be arrays/i);
  });

  it("throws if expense has no payer", () => {
    expect(() => simplifyDebts({
      expenses: [{ splits: [{ userId: "A", amountMinor: 100 }] }],
      settlements: []
    })).toThrow(/payer is required/i);
  });

  it("throws if expense has no splits or participants", () => {
    expect(() => simplifyDebts({
      expenses: [{ payerId: "A" }],
      settlements: []
    })).toThrow(/splits or participants are required/i);
  });

  it("handles split user from plain string", () => {
    const transfers = simplifyDebts({
      expenses: [{ payerId: "A", splits: [{ userId: "B", amountMinor: 100 }] }],
      settlements: []
    });
    expect(transfers[0].fromUserId).toBe("B");
  });

  it("throws if split amountMinor is invalid", () => {
    expect(() => simplifyDebts({
      expenses: [{ payerId: "A", splits: [{ userId: "B", amountMinor: -100 }] }],
      settlements: []
    })).toThrow(/positive integer/i);
  });

  it("throws if settlement has missing users", () => {
    expect(() => simplifyDebts({
      expenses: [],
      settlements: [{ fromUserId: "A", amountMinor: 100 }]
    })).toThrow(/users are required/i);
  });

  it("throws if settlement is self-transfer", () => {
    expect(() => simplifyDebts({
      expenses: [],
      settlements: [{ fromUserId: "A", toUserId: "A", amountMinor: 100 }]
    })).toThrow(/self-transfers/i);
  });

  it("throws if settlement amountMinor is invalid", () => {
    expect(() => simplifyDebts({
      expenses: [],
      settlements: [{ fromUserId: "A", toUserId: "B", amountMinor: 0 }]
    })).toThrow(/positive integer/i);
  });

  // Alternate input formats
  it("accepts paidBy as alias for payerId", () => {
    const transfers = simplifyDebts({
      expenses: [{ paidBy: "A", splits: [{ userId: "B", amountMinor: 100 }] }],
      settlements: []
    });
    expect(transfers).toEqual([{ fromUserId: "B", toUserId: "A", amountMinor: 100 }]);
  });

  it("accepts shareAmountMinor as alias for amountMinor in splits", () => {
    const transfers = simplifyDebts({
      expenses: [{ payerId: "A", splits: [{ userId: "B", shareAmountMinor: 100 }] }],
      settlements: []
    });
    expect(transfers).toEqual([{ fromUserId: "B", toUserId: "A", amountMinor: 100 }]);
  });

  it("auto-splits equal amounts when only participants array given", () => {
    const transfers = simplifyDebts({
      expenses: [{
        payerId: "A",
        amountMinor: 300,
        participants: ["A", "B", "C"]
      }],
      settlements: []
    });
    // A paid 300, split equally (100 each). A owes self 100, B and C owe A 100 each
    expect(transfers).toEqual([
      { fromUserId: "B", toUserId: "A", amountMinor: 100 },
      { fromUserId: "C", toUserId: "A", amountMinor: 100 }
    ]);
  });

  it("normalizes user ids from objects with _id", () => {
    const transfers = simplifyDebts({
      expenses: [{ payerId: { _id: "A" }, splits: [{ userId: { _id: "B" }, amountMinor: 100 }] }],
      settlements: []
    });
    expect(transfers[0].fromUserId).toBe("B");
    expect(transfers[0].toUserId).toBe("A");
  });
});
