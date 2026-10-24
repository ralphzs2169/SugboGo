import { z } from "zod";

const membershipSchema = z
  .object({
    business_id: z.number().int().positive(),
    pocket_ids: z.array(z.number().int().positive()),
    is_pocketed: z.boolean(),
  })
  .refine((value) => value.is_pocketed === value.pocket_ids.length > 0);

/** Validates a complete authoritative selection for the requested business. */
export function parsePocketMemberships(input: unknown, businessId: number) {
  const membership = membershipSchema.parse(input);
  z.literal(businessId).parse(membership.business_id);
  return membership;
}
