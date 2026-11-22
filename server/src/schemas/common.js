import { z } from "zod";

/**
 * MongoDB ObjectId validation schema
 */
export const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId format");

/**
 * Positive integer for amounts in minor units
 */
export const amountMinorSchema = z.number().int().positive().max(1e12);

/**
 * Email schema (Zod 4 style)
 */
export const emailSchema = z.email().max(255).toLowerCase();

/**
 * Record with max keys
 */
export function recordWithMax(keySchema, valueSchema, maxKeys = 50) {
  return z.record(keySchema, valueSchema).refine(
    (obj) => Object.keys(obj).length <= maxKeys,
    { message: `Cannot have more than ${maxKeys} entries` }
  );
}
