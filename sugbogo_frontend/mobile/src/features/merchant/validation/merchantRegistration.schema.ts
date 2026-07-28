import { z } from "zod";

export const merchantRegistrationSchema = z.object({
  businessName: z.string().min(1, "Business name is required."),

  businessCategory: z.string().min(1, "Business category is required."),

  businessDescription: z.string().min(1, "Business description is required."),

  contactNumber: z.string().min(1, "Contact number is required."),

  businessEmail: z
    .email({
      message: "Please enter a valid email.",
    })
    .or(z.literal("")),

  website: z
    .url({
      message: "Please enter a valid website URL.",
    })
    .or(z.literal("")),
});

export type MerchantRegistrationForm = z.infer<
  typeof merchantRegistrationSchema
>;
