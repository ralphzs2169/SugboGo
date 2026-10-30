import { z } from "zod";

/** Preserve only the existing backend contract; tolerate old caches with no field. */
export const businessRatingSchema = z.object({
  value: z.number().finite().min(1).max(5).nullable(),
  contributing_review_count: z.number().int().nonnegative().nullable(),
  state: z.enum(["pending", "ready", "insufficient_data", "unavailable"]),
  experimental: z.boolean(),
  provenance: z.enum(["legacy_unverified", "versioned"]).nullable(),
  scoring_version: z.string().nullable(),
  calculation_version: z.string(),
  computed_at: z.string().datetime({ offset: true }).nullable(),
  automatic_updates_enabled: z.boolean(),
});
