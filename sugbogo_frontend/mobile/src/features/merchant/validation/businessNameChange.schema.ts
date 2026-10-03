import { z } from "zod";

/** Mirrors the backend's trimmed 2–150 character business-name rule. */
export const businessNameChangeSchema = z.object({
  proposedBusinessName: z
    .string()
    .trim()
    .min(2, "Business name must be at least 2 characters.")
    .max(150, "Business name must be 150 characters or fewer."),
});
