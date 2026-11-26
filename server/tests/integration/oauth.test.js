import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import crypto from "crypto";
import "./setup.js";
import { app } from "../../src/app.js";
import User from "../../src/models/User.js";
import PendingRegistration from "../../src/models/PendingRegistration.js";
import { mockTransport } from "../../src/services/mailer.js";
import { env } from "../../src/config/env.js";

const CLIENT_ID = "google-client-id";
const CLIENT_SECRET = "google-client-secret";
const STATE_SECRET = "oauth-state-secret-for-tests-32-bytes";
const CLIENT_ORIGIN = env.APP_URL || env.primaryClientUrl;

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    json: async () => body
  };
}

function getFlow(startResponse) {
  const authorizationUrl = new URL(
    startResponse.headers.location || startResponse.body.authorizationUrl
  );
  const stateCookie = startResponse.headers["set-cookie"]
    .find((cookie) => cookie.startsWith("oauth_flow="))
    .split(";")[0];
  return { authorizationUrl, stateCookie };
}

async function beginGoogleFlow(mode = "login", accessToken) {
  if (mode === "link") {
    return request(app)
      .post("/api/auth/oauth/google/link")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});
  }
  return request(app).get("/api/auth/oauth/google");
}

async function createPasswordUser(email) {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ name: "OAuth Test User", email, password: "Password123" });
  await User.updateOne({ email }, { $set: { isEmailVerified: true } });
  return response;
}

describe("OAuth authorization flows", () => {
  beforeEach(() => {
    mockTransport.clear();
    env.GOOGLE_CLIENT_ID = CLIENT_ID;
    env.GOOGLE_CLIENT_SECRET = CLIENT_SECRET;
    env.GITHUB_CLIENT_ID = undefined;
    env.GITHUB_CLIENT_SECRET = undefined;
    env.OAUTH_STATE_SECRET = STATE_SECRET;
    env.REQUIRE_EMAIL_VERIFICATION = false;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    env.GOOGLE_CLIENT_ID = undefined;
    env.GOOGLE_CLIENT_SECRET = undefined;
    env.GITHUB_CLIENT_ID = undefined;
    env.GITHUB_CLIENT_SECRET = undefined;
    env.OAUTH_STATE_SECRET = undefined;
    env.REQUIRE_EMAIL_VERIFICATION = false;
    vi.unstubAllGlobals();
  });

  it("reports only providers with complete configuration", async () => {
    env.GITHUB_CLIENT_ID = "github-client-id";
    const incomplete = await request(app).get("/api/auth/providers");
    expect(incomplete.body.providers).toEqual(["google"]);

    env.GITHUB_CLIENT_SECRET = "github-client-secret";

    const response = await request(app).get("/api/auth/providers");

    expect(response.status).toBe(200);
    expect(response.body.providers).toEqual(["google", "github"]);
    expect(JSON.stringify(response.body)).not.toContain(CLIENT_SECRET);
  });

  it("uses state and PKCE before creating a CashDash session", async () => {
    const start = await beginGoogleFlow();
    const { authorizationUrl, stateCookie } = getFlow(start);
    const state = authorizationUrl.searchParams.get("state");
    const challenge = authorizationUrl.searchParams.get("code_challenge");

    expect(start.status).toBe(302);
    expect(authorizationUrl.origin).toBe("https://accounts.google.com");
    expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(state).toBeTruthy();
    expect(start.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(start.headers["set-cookie"][0]).toContain("SameSite=Lax");
    expect(start.headers["set-cookie"][0]).toContain("Path=/api/auth/oauth");

    const flowPayload = JSON.parse(
      Buffer.from(stateCookie.split("=")[1].split(".")[0], "base64url").toString("utf8")
    );
    expect(crypto.createHash("sha256").update(flowPayload.codeVerifier).digest("base64url"))
      .toBe(challenge);

    fetch.mockResolvedValueOnce(jsonResponse({ access_token: "provider-access-token" }))
      .mockResolvedValueOnce(jsonResponse({
        sub: "google-user-123",
        email: "oauth-user@example.com",
        email_verified: true,
        name: "OAuth User"
      }));

    const callback = await request(app)
      .get(`/api/auth/oauth/google/callback?code=oauth-code&state=${encodeURIComponent(state)}`)
      .set("Cookie", stateCookie);

    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe(`${CLIENT_ORIGIN}/oauth/callback`);
    expect(callback.headers.location).not.toContain("token=");
    expect(callback.headers["set-cookie"].some((cookie) => cookie.startsWith("refreshToken="))).toBe(true);

    const user = await User.findOne({ email: "oauth-user@example.com" });
    expect(user.isEmailVerified).toBe(true);
    expect(user.providerIdentities.map((identity) => identity.toObject())).toEqual([{
      provider: "google",
      providerUserId: "google-user-123"
    }]);
  });

  it("rejects a callback whose state does not match the flow cookie", async () => {
    const start = await beginGoogleFlow();
    const { authorizationUrl, stateCookie } = getFlow(start);
    const wrongState = `${authorizationUrl.searchParams.get("state")}x`;

    const callback = await request(app)
      .get(`/api/auth/oauth/google/callback?code=oauth-code&state=${wrongState}`)
      .set("Cookie", stateCookie);

    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe(`${CLIENT_ORIGIN}/login?oauthError=invalid_state`);
    expect(fetch).not.toHaveBeenCalled();
    expect(await User.countDocuments()).toBe(0);
  });

  it("rejects an expired signed OAuth flow", async () => {
    const start = await beginGoogleFlow();
    const { authorizationUrl, stateCookie } = getFlow(start);
    const originalValue = stateCookie.slice("oauth_flow=".length);
    const encodedPayload = originalValue.split(".")[0];
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    payload.expiresAt = Date.now() - 1;
    const expiredPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", STATE_SECRET)
      .update(expiredPayload)
      .digest("base64url");

    const callback = await request(app)
      .get(`/api/auth/oauth/google/callback?code=oauth-code&state=${authorizationUrl.searchParams.get("state")}`)
      .set("Cookie", `oauth_flow=${expiredPayload}.${signature}`);

    expect(callback.headers.location).toBe(`${CLIENT_ORIGIN}/login?oauthError=invalid_state`);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", { sub: "missing-email", name: "No Email" }],
    ["unverified", {
      sub: "unverified-email",
      email: "unverified@example.com",
      email_verified: false
    }]
  ])("rejects a Google profile with %s email", async (_caseName, profile) => {
    const start = await beginGoogleFlow();
    const { authorizationUrl, stateCookie } = getFlow(start);
    fetch.mockResolvedValueOnce(jsonResponse({ access_token: "provider-access-token" }))
      .mockResolvedValueOnce(jsonResponse(profile));

    const callback = await request(app)
      .get(`/api/auth/oauth/google/callback?code=oauth-code&state=${authorizationUrl.searchParams.get("state")}`)
      .set("Cookie", stateCookie);

    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe(`${CLIENT_ORIGIN}/login?oauthError=provider_email_unverified`);
    expect(callback.headers["set-cookie"].some((cookie) => cookie.startsWith("refreshToken="))).toBe(false);
    expect(await User.countDocuments()).toBe(0);
  });

  it.each(["login", "link"])("rejects disposable provider emails during %s", async (mode) => {
    let start;
    let existingUser;
    if (mode === "link") {
      const registration = await createPasswordUser("disposable-link-owner@example.com");
      existingUser = await User.findOne({ email: "disposable-link-owner@example.com" });
      start = await beginGoogleFlow("link", registration.body.accessToken);
    } else {
      start = await beginGoogleFlow();
    }

    const { authorizationUrl, stateCookie } = getFlow(start);
    fetch.mockResolvedValueOnce(jsonResponse({ access_token: "provider-access-token" }))
      .mockResolvedValueOnce(jsonResponse({
        sub: `disposable-google-${mode}`,
        email: "temporary@mailinator.com",
        email_verified: true,
        name: "Disposable Provider User"
      }));

    const callback = await request(app)
      .get(`/api/auth/oauth/google/callback?code=oauth-code&state=${authorizationUrl.searchParams.get("state")}`)
      .set("Cookie", stateCookie);

    const destination = mode === "link" ? "/profile" : "/login";
    expect(callback.headers.location).toBe(
      `${CLIENT_ORIGIN}${destination}?oauthError=disposable_email`
    );
    if (existingUser) {
      expect((await User.findById(existingUser._id)).providerIdentities).toHaveLength(0);
    } else {
      expect(await User.countDocuments()).toBe(0);
    }
  });

  it("replaces a pending password signup with a verified OAuth account without linking credentials", async () => {
    env.REQUIRE_EMAIL_VERIFICATION = true;
    const email = "oauth-pending-race@example.com";
    const registration = await request(app)
      .post("/api/auth/register")
      .send({ name: "Pending OAuth User", email, password: "Password123" });
    const verificationToken = mockTransport.sentEmails[0]?.html.match(/token=([a-f0-9]+)/)?.[1];
    expect(registration.status).toBe(202);
    expect(await User.findOne({ email })).toBeNull();
    expect(await PendingRegistration.countDocuments({ email })).toBe(1);

    const start = await beginGoogleFlow();
    const { authorizationUrl, stateCookie } = getFlow(start);
    fetch.mockResolvedValueOnce(jsonResponse({ access_token: "provider-access-token" }))
      .mockResolvedValueOnce(jsonResponse({
        sub: "oauth-pending-race",
        email,
        email_verified: true,
        name: "Verified OAuth User"
      }));

    const callback = await request(app)
      .get(`/api/auth/oauth/google/callback?code=oauth-code&state=${authorizationUrl.searchParams.get("state")}`)
      .set("Cookie", stateCookie);

    expect(callback.headers.location).toBe(`${CLIENT_ORIGIN}/oauth/callback`);
    expect(await PendingRegistration.countDocuments({ email })).toBe(0);
    const user = await User.findOne({ email }).select("+passwordHash");
    expect(user.isEmailVerified).toBe(true);
    expect(user.providerIdentities).toHaveLength(1);
    expect(user.passwordHash).toBeUndefined();

    const pendingToken = await request(app)
      .post("/api/auth/verify-email")
      .send({ token: verificationToken });
    const passwordLogin = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "Password123" });
    expect(pendingToken.status).toBe(400);
    expect(passwordLogin.status).toBe(401);
  });

  it("does not link a provider automatically from a matching email", async () => {
    await createPasswordUser("existing@example.com");
    const start = await beginGoogleFlow();
    const { authorizationUrl, stateCookie } = getFlow(start);
    fetch.mockResolvedValueOnce(jsonResponse({ access_token: "provider-access-token" }))
      .mockResolvedValueOnce(jsonResponse({
        sub: "google-user-collision",
        email: "existing@example.com",
        email_verified: true,
        name: "Existing Account"
      }));

    const callback = await request(app)
      .get(`/api/auth/oauth/google/callback?code=oauth-code&state=${authorizationUrl.searchParams.get("state")}`)
      .set("Cookie", stateCookie);

    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe(`${CLIENT_ORIGIN}/login?oauthError=account_exists_sign_in`);
    const user = await User.findOne({ email: "existing@example.com" });
    expect(user.providerIdentities).toHaveLength(0);
  });

  it("links a provider only to the authenticated user who initiated linking", async () => {
    const registration = await createPasswordUser("link-user@example.com");
    const accessToken = registration.body.accessToken;
    const start = await beginGoogleFlow("link", accessToken);
    const { authorizationUrl, stateCookie } = getFlow(start);

    expect(start.status).toBe(200);
    expect(start.body.authorizationUrl).toContain("accounts.google.com");
    fetch.mockResolvedValueOnce(jsonResponse({ access_token: "provider-access-token" }))
      .mockResolvedValueOnce(jsonResponse({
        sub: "linked-google-user",
        email: "different-provider-email@example.com",
        email_verified: true,
        name: "Linked User"
      }));

    const callback = await request(app)
      .get(`/api/auth/oauth/google/callback?code=oauth-code&state=${authorizationUrl.searchParams.get("state")}`)
      .set("Cookie", stateCookie);

    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe(`${CLIENT_ORIGIN}/profile?oauthLinked=google`);
    expect(callback.headers["set-cookie"].some((cookie) => cookie.startsWith("refreshToken="))).toBe(false);
    const user = await User.findOne({ email: "link-user@example.com" });
    expect(user.providerIdentities.map((identity) => identity.toObject())).toEqual([{
      provider: "google",
      providerUserId: "linked-google-user"
    }]);
  });

  it("does not link a provider identity already owned by another user", async () => {
    const firstRegistration = await createPasswordUser("first-link@example.com");
    const firstStart = await beginGoogleFlow("link", firstRegistration.body.accessToken);
    const firstFlow = getFlow(firstStart);
    fetch.mockResolvedValueOnce(jsonResponse({ access_token: "provider-token" }))
      .mockResolvedValueOnce(jsonResponse({
        sub: "already-linked-google-user",
        email: "provider@example.com",
        email_verified: true,
        name: "Provider User"
      }));
    await request(app)
      .get(`/api/auth/oauth/google/callback?code=code-one&state=${firstFlow.authorizationUrl.searchParams.get("state")}`)
      .set("Cookie", firstFlow.stateCookie);

    const secondRegistration = await createPasswordUser("second-link@example.com");
    const secondStart = await beginGoogleFlow("link", secondRegistration.body.accessToken);
    const secondFlow = getFlow(secondStart);
    fetch.mockResolvedValueOnce(jsonResponse({ access_token: "provider-token" }))
      .mockResolvedValueOnce(jsonResponse({
        sub: "already-linked-google-user",
        email: "provider@example.com",
        email_verified: true,
        name: "Provider User"
      }));
    const callback = await request(app)
      .get(`/api/auth/oauth/google/callback?code=code-two&state=${secondFlow.authorizationUrl.searchParams.get("state")}`)
      .set("Cookie", secondFlow.stateCookie);

    expect(callback.headers.location).toBe(`${CLIENT_ORIGIN}/profile?oauthError=identity_already_linked`);
    expect((await User.findOne({ email: "second-link@example.com" })).providerIdentities)
      .toHaveLength(0);
  });

  it("does not let a demo session link a provider", async () => {
    const demo = await request(app).post("/api/auth/demo");

    const response = await request(app)
      .post("/api/auth/oauth/google/link")
      .set("Authorization", `Bearer ${demo.body.accessToken}`)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.error).toContain("Demo users");
  });

  it("uses only the primary verified GitHub email", async () => {
    env.GITHUB_CLIENT_ID = "github-client-id";
    env.GITHUB_CLIENT_SECRET = "github-client-secret";
    const start = await request(app).get("/api/auth/oauth/github");
    const { authorizationUrl, stateCookie } = getFlow(start);
    fetch.mockResolvedValueOnce(jsonResponse({ access_token: "github-access-token" }))
      .mockResolvedValueOnce(jsonResponse({ id: 12345, login: "cash-user", name: null }))
      .mockResolvedValueOnce(jsonResponse([
        { email: "secondary@example.com", primary: false, verified: true },
        { email: "primary@example.com", primary: true, verified: true },
        { email: "unverified@example.com", primary: false, verified: false }
      ]));

    const callback = await request(app)
      .get(`/api/auth/oauth/github/callback?code=github-code&state=${authorizationUrl.searchParams.get("state")}`)
      .set("Cookie", stateCookie);

    expect(callback.headers.location).toBe(`${CLIENT_ORIGIN}/oauth/callback`);
    const user = await User.findOne({ email: "primary@example.com" });
    expect(user.name).toBe("cash-user");
    expect(user.providerIdentities.map((identity) => identity.toObject())).toEqual([{
      provider: "github",
      providerUserId: "12345"
    }]);
  });

  it("rejects GitHub accounts without a primary verified email", async () => {
    env.GITHUB_CLIENT_ID = "github-client-id";
    env.GITHUB_CLIENT_SECRET = "github-client-secret";
    const start = await request(app).get("/api/auth/oauth/github");
    const { authorizationUrl, stateCookie } = getFlow(start);
    fetch.mockResolvedValueOnce(jsonResponse({ access_token: "github-access-token" }))
      .mockResolvedValueOnce(jsonResponse({ id: 98765, login: "no-email" }))
      .mockResolvedValueOnce(jsonResponse([
        { email: "unverified@example.com", primary: true, verified: false }
      ]));

    const callback = await request(app)
      .get(`/api/auth/oauth/github/callback?code=github-code&state=${authorizationUrl.searchParams.get("state")}`)
      .set("Cookie", stateCookie);

    expect(callback.headers.location).toBe(`${CLIENT_ORIGIN}/login?oauthError=provider_email_unverified`);
    expect(callback.headers["set-cookie"].some((cookie) => cookie.startsWith("refreshToken="))).toBe(false);
    expect(await User.countDocuments()).toBe(0);
  });
});
