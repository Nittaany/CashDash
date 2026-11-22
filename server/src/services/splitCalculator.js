const assertPositiveInteger = (value, name) => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
};

const normalizeParticipant = (participant) => {
  if (participant && typeof participant === "object") {
    return String(participant.id ?? participant._id ?? participant.userId ?? "");
  }
  return String(participant);
};

const normalizeParticipants = (participants) => {
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error("participants must contain at least one active participant");
  }

  const normalized = participants.map(normalizeParticipant);
  if (normalized.some((id) => !id)) {
    throw new Error("participant identifiers must be non-empty");
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("participants must be unique");
  }
  return normalized;
};

const getExactShares = (exactSharesMinor, participantIds) => {
  if (!exactSharesMinor) {
    throw new Error("exactSharesMinor is required");
  }

  if (Array.isArray(exactSharesMinor)) {
    if (exactSharesMinor.length !== participantIds.length) {
      throw new Error("exact shares must include exactly the active participants");
    }
    return participantIds.map((userId, index) => ({
      userId,
      amountMinor: exactSharesMinor[index]
    }));
  }

  if (typeof exactSharesMinor !== "object") {
    throw new Error("exactSharesMinor must be an object or array");
  }

  const shareKeys = Object.keys(exactSharesMinor);
  const active = new Set(participantIds);
  if (shareKeys.some((userId) => !active.has(userId))) {
    throw new Error("exact shares contain a participant outside the active set");
  }
  if (shareKeys.length !== participantIds.length ||
      participantIds.some((userId) => !Object.prototype.hasOwnProperty.call(exactSharesMinor, userId))) {
    throw new Error("exact shares must include exactly the active participants");
  }

  return participantIds.map((userId) => ({
    userId,
    amountMinor: exactSharesMinor[userId]
  }));
};

const getPercentShares = (percentShares, participantIds) => {
  if (!percentShares) {
    throw new Error("percentShares is required");
  }

  if (Array.isArray(percentShares)) {
    if (percentShares.length !== participantIds.length) {
      throw new Error("percentage shares must include exactly the active participants");
    }
    return participantIds.map((userId, index) => ({
      userId,
      percent: percentShares[index]
    }));
  }

  if (typeof percentShares !== "object") {
    throw new Error("percentShares must be an object or array");
  }

  const active = new Set(participantIds);
  if (Object.keys(percentShares).some((userId) => !active.has(userId))) {
    throw new Error("percentage shares contain a participant outside the active set");
  }
  if (Object.keys(percentShares).length !== participantIds.length ||
      participantIds.some((userId) => !Object.prototype.hasOwnProperty.call(percentShares, userId))) {
    throw new Error("percentage shares must include exactly the active participants");
  }

  return participantIds.map((userId) => ({
    userId,
    percent: percentShares[userId]
  }));
};

export function calculateSplits({
  amountMinor,
  splitType,
  participants,
  exactSharesMinor,
  percentShares
}) {
  assertPositiveInteger(amountMinor, "amountMinor");
  const participantIds = normalizeParticipants(participants);

  if (splitType === "EQUAL") {
    const base = Math.floor(amountMinor / participantIds.length);
    const remainder = amountMinor % participantIds.length;
    const splits = participantIds.map((userId, index) => ({
      userId,
      amountMinor: base + (index < remainder ? 1 : 0)
    }));

    if (splits.reduce((sum, split) => sum + split.amountMinor, 0) !== amountMinor) {
      throw new Error("EQUAL split lost integer conservation");
    }
    return splits;
  }

  if (splitType === "EXACT") {
    const splits = getExactShares(exactSharesMinor, participantIds);
    splits.forEach(({ amountMinor: share }) => assertPositiveInteger(share, "exact share"));
    if (splits.reduce((sum, split) => sum + split.amountMinor, 0) !== amountMinor) {
      throw new Error("exact shares must sum to amountMinor");
    }
    return splits;
  }

  if (splitType === "PERCENT") {
    const shares = getPercentShares(percentShares, participantIds);
    const basisPoints = shares.map(({ percent }) => {
      if (typeof percent !== "number" || !Number.isFinite(percent) || percent <= 0) {
        throw new Error("percentages must be positive numbers");
      }
      return Math.round(percent * 100);
    });

    const totalBasisPoints = basisPoints.reduce((sum, value) => sum + value, 0);
    if (Math.abs(totalBasisPoints - 10000) > 1) {
      throw new Error("percentages must sum to 100");
    }

    const splits = shares.map(({ userId }, index) => ({
      userId,
      amountMinor: Math.floor((amountMinor * basisPoints[index]) / 10000),
      percent: shares[index].percent
    }));

    const remainder = amountMinor -
      splits.reduce((sum, split) => sum + split.amountMinor, 0);
    for (let index = 0; index < remainder; index += 1) {
      splits[index % splits.length].amountMinor += 1;
    }

    if (splits.reduce((sum, split) => sum + split.amountMinor, 0) !== amountMinor) {
      throw new Error("PERCENT split lost integer conservation");
    }
    return splits;
  }

  throw new Error("splitType must be EQUAL, EXACT, or PERCENT");
}
