import "dotenv/config";
import { z } from "zod";

// Validates comma-separated list of valid URLs (using z.url() per trimmed origin)
const clientUrlSchema = z.string().min(1).refine(
  (val) => {
    const origins = val.split(",").map((o) => o.trim());
    return origins.every((origin) => {
      // Use z.url() to validate each origin
      const result = z.url().safeParse(origin);
      if (!result.success) return false;
      
      try {
        const url = new URL(origin);
        // Must be http or https with no path (except /) and no trailing slash
        return (
          (url.protocol === "http:" || url.protocol === "https:") &&
          url.pathname === "/" &&
          !origin.endsWith("/")
        );
      } catch {
        return false;
      }
    });
  },
  { message: "CLIENT_URL must be comma-separated http(s) origins with no path or trailing slash" }
);

// Optional single origin for email links (overrides first CLIENT_URL entry)
const appUrlSchema = z.string().optional().refine(
  (val) => {
    if (!val) return true;
    const result = z.url().safeParse(val);
    if (!result.success) return false;
    try {
      const url = new URL(val);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        url.pathname === "/" &&
        !val.endsWith("/")
      );
    } catch {
      return false;
    }
  },
  { message: "APP_URL must be a single http(s) origin with no path or trailing slash" }
);

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5001),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CLIENT_URL: clientUrlSchema,
  APP_URL: appUrlSchema,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  COOKIE_SAMESITE: z.enum(["strict", "lax", "none"]).default("lax"),
  // Optional Resend mailer config
  RESEND_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.string().default("CashDash <onboarding@resend.dev>"),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_CLIENT_SECRET: z.string().min(1).optional(),
  OAUTH_STATE_SECRET: z.string().min(32).optional(),
  // Email verification toggle (default false in dev/test, enable in production)
  REQUIRE_EMAIL_VERIFICATION: z.enum(["true", "false"]).default("false").transform((v) => v === "true")
}).superRefine((config, context) => {
  if (
    config.NODE_ENV === "production" &&
    config.REQUIRE_EMAIL_VERIFICATION &&
    !config.RESEND_API_KEY
  ) {
    context.addIssue({
      code: "custom",
      path: ["RESEND_API_KEY"],
      message: "RESEND_API_KEY is required when production email verification is enabled"
    });
  }

  for (const [provider, clientId, clientSecret] of [
    ["Google", config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET],
    ["GitHub", config.GITHUB_CLIENT_ID, config.GITHUB_CLIENT_SECRET]
  ]) {
    if (Boolean(clientId) !== Boolean(clientSecret)) {
      context.addIssue({
        code: "custom",
        path: [`${provider.toUpperCase()}_CLIENT_SECRET`],
        message: `${provider} OAuth client ID and secret must be configured together`
      });
    }
  }

  const oauthConfigured = Boolean(config.GOOGLE_CLIENT_ID || config.GITHUB_CLIENT_ID);
  if (oauthConfigured && !config.OAUTH_STATE_SECRET) {
    context.addIssue({
      code: "custom",
      path: ["OAUTH_STATE_SECRET"],
      message: "OAUTH_STATE_SECRET is required when an OAuth provider is configured"
    });
  }
});

const parsed = envSchema.parse(process.env);

// Derive primaryClientUrl: APP_URL if set, otherwise first CLIENT_URL entry
const primaryClientUrl = parsed.APP_URL || parsed.CLIENT_URL.split(",")[0].trim();

export const env = { ...parsed, primaryClientUrl };

// Export for testing
export { clientUrlSchema, envSchema };
