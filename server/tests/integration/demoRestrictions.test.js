import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import jwt from "jsonwebtoken";
import User from "../../src/models/User.js";
import Group from "../../src/models/Group.js";
import { app } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import "./setup.js";

function generateToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email, isDemo: user.isDemo },
    env.JWT_ACCESS_SECRET,
    { algorithm: "HS256", expiresIn: "15m" }
  );
}

describe("Demo user add-member restrictions", () => {
  let demoUser;
  let normalUser;
  let existingUser;
  let demoToken;
  let normalToken;
  let demoGroup;
  let normalGroup;

  beforeEach(async () => {
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    demoUser = await User.create({
      name: "Demo User",
      email: `demo-${Date.now()}@cashdash.app`,
      passwordHash: await bcrypt.hash("password123", 10),
      currency: "NPR",
      isDemo: true,
      expiresAt
    });

    normalUser = await User.create({
      name: "Normal User",
      email: `normal-${Date.now()}@example.com`,
      passwordHash: await bcrypt.hash("password123", 10),
      currency: "NPR"
    });

    existingUser = await User.create({
      name: "Existing User",
      email: `existing-${Date.now()}@example.com`,
      passwordHash: await bcrypt.hash("password123", 10),
      currency: "NPR"
    });

    demoToken = generateToken(demoUser);
    normalToken = generateToken(normalUser);

    demoGroup = await Group.create({
      name: "Demo Group",
      currency: "NPR",
      createdBy: demoUser._id,
      members: [demoUser._id]
    });

    normalGroup = await Group.create({
      name: "Normal Group",
      currency: "NPR",
      createdBy: normalUser._id,
      members: [normalUser._id]
    });
  });

  it("demo user gets generic response when adding existing email", async () => {
    const res = await request(app)
      .post(`/api/groups/${demoGroup._id}/members`)
      .set("Authorization", `Bearer ${demoToken}`)
      .send({ email: existingUser.email });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Invitation sent");
    // Should NOT actually add the member
    expect(res.body.group).toBeUndefined();

    const group = await Group.findById(demoGroup._id);
    expect(group.members.length).toBe(1);
  });

  it("demo user gets generic response when adding non-existent email", async () => {
    const res = await request(app)
      .post(`/api/groups/${demoGroup._id}/members`)
      .set("Authorization", `Bearer ${demoToken}`)
      .send({ email: "nonexistent@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Invitation sent");
    expect(res.body.group).toBeUndefined();
  });

  it("normal user can add existing user to group", async () => {
    const res = await request(app)
      .post(`/api/groups/${normalGroup._id}/members`)
      .set("Authorization", `Bearer ${normalToken}`)
      .send({ email: existingUser.email });

    expect(res.status).toBe(200);
    expect(res.body.group).toBeDefined();
    expect(res.body.group.members.length).toBe(2);
  });

  it("normal user gets generic response for non-existent email (no user enumeration)", async () => {
    const res = await request(app)
      .post(`/api/groups/${normalGroup._id}/members`)
      .set("Authorization", `Bearer ${normalToken}`)
      .send({ email: "nonexistent@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Invitation sent");
    expect(res.body.group).toBeUndefined();
  });
});
