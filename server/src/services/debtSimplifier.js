const normalizeId = (value) =>
  String(value?.id ?? value?._id ?? value?.userId ?? value ?? "");

const addBalance = (balances, userId, amountMinor) => {
  balances.set(userId, (balances.get(userId) ?? 0) + amountMinor);
};

export function simplifyDebts({ expenses = [], settlements = [] }) {
  if (!Array.isArray(expenses) || !Array.isArray(settlements)) {
    throw new Error("expenses and settlements must be arrays");
  }

  const balances = new Map();

  for (const expense of expenses) {
    const payerId = normalizeId(expense.payerId ?? expense.paidBy);
    if (!payerId) throw new Error("expense payer is required");

    let splits = expense.splits;
    if (!Array.isArray(splits) || splits.length === 0) {
      const participants = expense.participants ?? expense.splits;
      if (!Array.isArray(participants) || participants.length === 0) {
        throw new Error("expense splits or participants are required");
      }
      if (typeof participants[0] === "object" && participants[0] !== null &&
          participants[0].amountMinor != null) {
        splits = participants;
      } else {
        const participantIds = participants.map(normalizeId);
        const amountMinor = expense.amountMinor;
        const base = Math.floor(amountMinor / participantIds.length);
        const remainder = amountMinor % participantIds.length;
        splits = participantIds.map((userId, index) => ({
          userId,
          amountMinor: base + (index < remainder ? 1 : 0)
        }));
      }
    }

    for (const split of splits) {
      const userId = normalizeId(split.userId ?? split);
      const amountMinor = Number(split.amountMinor ?? split.shareAmountMinor);
      if (!userId) throw new Error("split user is required");
      if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
        throw new Error("split amountMinor must be a positive integer");
      }

      if (userId !== payerId) {
        addBalance(balances, userId, -amountMinor);
        addBalance(balances, payerId, amountMinor);
      }
    }
  }

  for (const settlement of settlements) {
    const fromUserId = normalizeId(settlement.fromUserId);
    const toUserId = normalizeId(settlement.toUserId);
    const amountMinor = Number(settlement.amountMinor);

    if (!fromUserId || !toUserId) throw new Error("settlement users are required");
    if (fromUserId === toUserId) throw new Error("settlements cannot be self-transfers");
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      throw new Error("settlement amountMinor must be a positive integer");
    }

    addBalance(balances, fromUserId, amountMinor);
    addBalance(balances, toUserId, -amountMinor);
  }

  const netBalances = new Map([...balances].filter(([, amount]) => amount !== 0));
  const debtors = [];
  const creditors = [];

  for (const [userId, amountMinor] of netBalances) {
    if (amountMinor < 0) debtors.push({ userId, amountMinor: -amountMinor });
    if (amountMinor > 0) creditors.push({ userId, amountMinor });
  }

  debtors.sort((a, b) => b.amountMinor - a.amountMinor || a.userId.localeCompare(b.userId));
  creditors.sort((a, b) => b.amountMinor - a.amountMinor || a.userId.localeCompare(b.userId));

  const transfers = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountMinor = Math.min(debtor.amountMinor, creditor.amountMinor);

    if (debtor.userId !== creditor.userId && amountMinor > 0) {
      transfers.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amountMinor
      });
    }

    debtor.amountMinor -= amountMinor;
    creditor.amountMinor -= amountMinor;
    if (debtor.amountMinor === 0) debtorIndex += 1;
    if (creditor.amountMinor === 0) creditorIndex += 1;
  }

  const netTotal = [...netBalances.values()].reduce((sum, amount) => sum + amount, 0);
  const transferTotalFrom = transfers.reduce((sum, transfer) => sum - transfer.amountMinor, 0);
  const transferTotalTo = transfers.reduce((sum, transfer) => sum + transfer.amountMinor, 0);

  if (netTotal !== 0) throw new Error("net balances must sum to zero");
  if (transferTotalFrom !== -transferTotalTo) {
    throw new Error("simplified transfers must conserve balance");
  }
  if (transfers.some((transfer) => transfer.fromUserId === transfer.toUserId)) {
    throw new Error("simplified transfers cannot contain self-transfers");
  }

  return transfers;
}
