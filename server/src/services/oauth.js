import crypto from "crypto";
import { env } from "../config/env.js";

const PROVIDERS = ["google", "github"];

function providerConfig(provider) {
  if (!PROVIDERS.includes(provider)) return null;

  const prefix = provider.toUpperCase();
  const clientId = env[`${prefix}_CLIENT_ID`];
  const clientSecret = env[`${prefix}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) return null;

  return { clientId, clientSecret };
}

export function getConfiguredOAuthProviders() {
  return PROVIDERS.filter((provider) => providerConfig(provider));
}

export function getOAuthCallbackUrl(provider) {
  if (!PROVIDERS.includes(provider)) {
    throw new Error("Unsupported OAuth provider");
  }

  const origin = env.APP_URL || env.primaryClientUrl;
  return `${origin}/api/auth/oauth/${provider}/callback`;
}

export function generateOAuthState() {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateOAuthCodeVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

export function createOAuthAuthorizationUrl(provider, state, codeVerifier) {
  const config = providerConfig(provider);
  if (!config) {
    throw new Error("OAuth provider is not configured");
  }

  const url = provider === "google"
    ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
    : new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", getOAuthCallbackUrl(provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", crypto.createHash("sha256")
    .update(codeVerifier)
    .digest("base64url"));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set(
    "scope",
    provider === "google" ? "openid email profile" : "read:user user:email"
  );
  return url.toString();
}

async function fetchJson(url, options, failureMessage) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(failureMessage);
  }

  const data = await response.json();
  if (!data || typeof data !== "object") {
    throw new Error(failureMessage);
  }
  return data;
}

export async function exchangeOAuthCode(provider, code, codeVerifier) {
  const config = providerConfig(provider);
  if (!config) {
    throw new Error("OAuth provider is not configured");
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: getOAuthCallbackUrl(provider)
  });
  const tokenUrl = provider === "google"
    ? "https://oauth2.googleapis.com/token"
    : "https://github.com/login/oauth/access_token";
  const tokens = await fetchJson(tokenUrl, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  }, "OAuth token exchange failed");

  if (typeof tokens.access_token !== "string" || !tokens.access_token) {
    throw new Error("OAuth token exchange failed");
  }
  return tokens.access_token;
}

export async function getOAuthProfile(provider, accessToken) {
  if (provider === "google") {
    const profile = await fetchJson(
      "https://openidconnect.googleapis.com/v1/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } },
      "Google profile lookup failed"
    );
    if (
      typeof profile.sub !== "string" ||
      typeof profile.email !== "string" ||
      profile.email_verified !== true
    ) {
      throw new Error("OAuth provider email is missing or unverified");
    }

    return {
      providerUserId: profile.sub,
      email: profile.email.toLowerCase(),
      name: typeof profile.name === "string" && profile.name.trim()
        ? profile.name.trim()
        : "CashDash User"
    };
  }

  if (provider === "github") {
    const headers = {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${accessToken}`,
      "User-Agent": "CashDash",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    const [profile, emails] = await Promise.all([
      fetchJson("https://api.github.com/user", { headers }, "GitHub profile lookup failed"),
      fetchJson("https://api.github.com/user/emails", { headers }, "GitHub email lookup failed")
    ]);
    const verifiedEmail = Array.isArray(emails)
      ? emails.find((entry) => entry?.primary === true && entry?.verified === true)
      : null;
    if (
      (typeof profile.id !== "number" && typeof profile.id !== "string") ||
      typeof verifiedEmail?.email !== "string"
    ) {
      throw new Error("OAuth provider email is missing or unverified");
    }

    return {
      providerUserId: String(profile.id),
      email: verifiedEmail.email.toLowerCase(),
      name: typeof profile.name === "string" && profile.name.trim()
        ? profile.name.trim()
        : typeof profile.login === "string" && profile.login.trim()
          ? profile.login.trim()
          : "CashDash User"
    };
  }

  throw new Error("Unsupported OAuth provider");
}
