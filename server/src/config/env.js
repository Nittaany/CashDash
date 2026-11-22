import "dotenv/config";
import { z } from "zod";

// Validates that a string is an http(s) origin with no path or trailing slash
const httpOriginSchema = z.string().refine(
  (val) => {
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
  { message: "Must be an http(s) origin with no path or trailing slash" }
);

// Validates comma-separated list of http(s) origins
const clientUrlSchema = z.string().min(1).refine(
  (val) => {
    const origins = val.split(",").map((o) => o.trim());
    return origins.every((origin) => {
      try {
        const url = new URL(origin);
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

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CLIENT_URL: clientUrlSchema,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  COOKIE_SAMESITE: z.enum(["strict", "lax", "none"]).default("lax")
});

export const env = envSchema.parse(process.env);

// Export for testing
export { clientUrlSchema };
