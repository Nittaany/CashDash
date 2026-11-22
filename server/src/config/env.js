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

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5001),
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
