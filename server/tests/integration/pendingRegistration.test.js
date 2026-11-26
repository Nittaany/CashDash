import { describe, expect, it } from "vitest";
import PendingRegistration from "../../src/models/PendingRegistration.js";
import "./setup.js";

describe("PendingRegistration model", () => {
  it("defines a TTL index for pending-registration expiry", () => {
    const expiresAtIndex = PendingRegistration.schema.indexes().find(
      ([keys]) => keys.expiresAt === 1
    );

    expect(expiresAtIndex?.[1].expireAfterSeconds).toBe(0);
  });

  it("normalizes email and enforces uniqueness", async () => {
    await PendingRegistration.init();

    const registration = {
      name: "Pending User",
      email: "  Pending.User@Example.com ",
      passwordHash: "password-hash",
      emailVerifyTokenHash: "token-hash",
      expiresAt: new Date(Date.now() + 60_000)
    };

    const created = await PendingRegistration.create(registration);
    expect(created.email).toBe("pending.user@example.com");

    await expect(
      PendingRegistration.create({
        ...registration,
        email: "pending.user@example.com"
      })
    ).rejects.toMatchObject({ code: 11000 });
  });
});
