import { z } from "zod";

export const merchantRegistrationSchema = z.object({
  businessName: z.string().min(1, "Business name is required."),

  businessCluster: z.string().min(1, "Business cluster is required."),

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

  representativeName: z
    .string()
    .trim()
    .min(1, "Representative name is required."),

  representativeRole: z.string().min(1, "Please select your role."),

  // Business Location
  province: z.string(),

  city: z.string(),

  barangay: z.string(),

  streetAddress: z.string().trim().min(1, "Street address is required."),

  unit: z.string(),

  // Nearby Landmarks
  landmarks: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      address: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      source: z.enum(["google", "custom"]),
      placeId: z.string().optional(),
    }),
  ),

  latitude: z.number().nullable(),

  longitude: z.number().nullable(),

  // Operating Hours
  operatingHours: z.object({
    monday: z.object({
      isOpen: z.boolean(),
      openTime: z.string(),
      closeTime: z.string(),
    }),

    tuesday: z.object({
      isOpen: z.boolean(),
      openTime: z.string(),
      closeTime: z.string(),
    }),

    wednesday: z.object({
      isOpen: z.boolean(),
      openTime: z.string(),
      closeTime: z.string(),
    }),

    thursday: z.object({
      isOpen: z.boolean(),
      openTime: z.string(),
      closeTime: z.string(),
    }),

    friday: z.object({
      isOpen: z.boolean(),
      openTime: z.string(),
      closeTime: z.string(),
    }),

    saturday: z.object({
      isOpen: z.boolean(),
      openTime: z.string(),
      closeTime: z.string(),
    }),

    sunday: z.object({
      isOpen: z.boolean(),
      openTime: z.string(),
      closeTime: z.string(),
    }),
  }),

  businessPhotos: z.object({
    storefront: z.string().nullable(),
    interior: z.array(z.string()),
    products: z.array(z.string()),
    additional: z.array(z.string()),
  }),

  verificationDocuments: z.object({
    businessRegistration: z.string().nullable(),
    authorizationDocument: z.string().nullable(),
    additionalDocuments: z.array(z.string()),
  }),
});

export type MerchantRegistrationForm = z.infer<
  typeof merchantRegistrationSchema
>;
