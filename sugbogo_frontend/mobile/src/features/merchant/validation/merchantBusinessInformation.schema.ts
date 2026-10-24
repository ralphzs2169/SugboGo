import { z } from "zod";

import { merchantRegistrationSchema } from "./merchantRegistration.schema";

/** Reuses existing information rules and adds optional post-registration directions. */
export const merchantBusinessInformationSchema = merchantRegistrationSchema
  .pick({
    businessDescription: true,
    contactNumber: true,
    businessEmail: true,
    website: true,
  })
  .extend({
    accessDirections: z
      .string()
      .trim()
      .max(1000, "Directions must be 1,000 characters or fewer."),
  });
