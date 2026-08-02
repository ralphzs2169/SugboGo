import { z } from "zod";

const operatingHoursDaySchema = z
  .object({
    isOpen: z.boolean(),
    is24Hours: z.boolean(),
    openTime: z.string(),
    closeTime: z.string(),
  })
  .superRefine((day, ctx) => {
    // Closed days don't require times.
    if (!day.isOpen) {
      return;
    }

    // 24-hour days don't require times.
    if (day.is24Hours) {
      return;
    }

    // Open normal schedule requires both times.
    if (!day.openTime) {
      ctx.addIssue({
        code: "custom",
        path: ["openTime"],
        message: "Opening time is required.",
      });
    }

    if (!day.closeTime) {
      ctx.addIssue({
        code: "custom",
        path: ["closeTime"],
        message: "Closing time is required.",
      });
    }

    // Don't compare empty values.
    if (!day.openTime || !day.closeTime) {
      return;
    }

    // Same opening and closing time isn't a valid schedule.
    if (day.openTime === day.closeTime) {
      ctx.addIssue({
        code: "custom",
        path: ["closeTime"],
        message: "Closing time must be different from opening time.",
      });
    }
  });

const operatingHoursSchema = z
  .object({
    monday: operatingHoursDaySchema,
    tuesday: operatingHoursDaySchema,
    wednesday: operatingHoursDaySchema,
    thursday: operatingHoursDaySchema,
    friday: operatingHoursDaySchema,
    saturday: operatingHoursDaySchema,
    sunday: operatingHoursDaySchema,
  })
  .superRefine((hours, ctx) => {
    const hasOpenDay = Object.values(hours).some((day) => day.isOpen);

    if (!hasOpenDay) {
      ctx.addIssue({
        code: "custom",
        path: [],
        message: "At least one day must be open.",
      });
    }
  });

const businessPhotoSchema = z.object({
  uri: z.string(),
  fileName: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
});

const businessDocumentSchema = z.object({
  uri: z.string(),
  fileName: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
});

const verificationDocumentsSchema = z
  .object({
    businessRegistration: businessDocumentSchema.nullable(),

    authorizationDocument: businessDocumentSchema.nullable(),

    additionalDocuments: z
      .array(businessDocumentSchema)
      .max(5, "You can add up to 5 additional documents."),
  })
  .superRefine((documents, ctx) => {
    if (!documents.businessRegistration) {
      ctx.addIssue({
        code: "custom",
        path: ["businessRegistration"],
        message: "Business registration document is required.",
      });
    }
  });

export const merchantRegistrationSchema = z.object({
  businessName: z.string().min(1, "Business name is required."),

  businessCluster: z.string().min(1, "Business cluster is required."),

  businessCategory: z.string().min(1, "Business category is required."),

  businessDescription: z.string().min(1, "Business description is required."),

  contactNumber: z.string().min(1, "Contact number is required."),

  specialtyTags: z
    .array(z.number())
    .length(3, "Please select exactly 3 specialty tags."),

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
  operatingHours: operatingHoursSchema,

  businessPhotos: z.object({
    storefront: z
      .array(businessPhotoSchema)
      .min(1, "At least one storefront photo is required.")
      .max(3, "You can add up to 3 storefront photos."),

    interior: z.array(businessPhotoSchema),

    products: z.array(businessPhotoSchema),

    additional: z.array(businessPhotoSchema),
  }),

  // Verification Document
  verificationDocuments: verificationDocumentsSchema,
});

export type MerchantRegistrationForm = z.infer<
  typeof merchantRegistrationSchema
>;
