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
});
