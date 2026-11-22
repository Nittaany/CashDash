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
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("CashDash <onboarding@resend.dev>"),
  // Email verification toggle (default false in dev/test, enable in production)
  REQUIRE_EMAIL_VERIFICATION: z.enum(["true", "false"]).default("false").transform((v) => v === "true")
});

const parsed = envSchema.parse(process.env);

// Derive primaryClientUrl: APP_URL if set, otherwise first CLIENT_URL entry
const primaryClientUrl = parsed.APP_URL || parsed.CLIENT_URL.split(",")[0].trim();

export const env = { ...parsed, primaryClientUrl };

// Export for testing
export { clientUrlSchema };
