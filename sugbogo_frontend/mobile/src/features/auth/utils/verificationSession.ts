import { z } from "zod";

import { AVATAR_KEYS } from "@/shared/constants/avatars";
import type { AuthResponse } from "../types/auth.types";

const jwt = z.string().regex(/^[\w-]+\.[\w-]+\.[\w-]+$/);

const verificationSession = z.object({
  access: jwt,
  refresh: jwt,
  user: z.object({
    id: z.number().int().positive(),
    first_name: z.string(),
    last_name: z.string(),
    gender: z.enum(["male", "female", "non_binary", "prefer_not_to_say"]).nullable(),
    avatar_url: z.string().nullish(),
    avatar_key: z.enum(AVATAR_KEYS).nullish(),
    email: z.string().min(1),
    role: z.literal("explorer"),
    status: z.literal("active"),
    has_completed_interest_selection: z.boolean(),
    has_custom_profile_picture: z.boolean(),
    has_oauth_accounts: z.boolean(),
    has_usable_password: z.boolean().optional(),
  }),
});

/** Accepts the complete mobile login payload for an active Explorer. */
export function parseVerificationSession(data: unknown): AuthResponse | null {
  const result = verificationSession.safeParse(data);
  return result.success ? result.data : null;
}
