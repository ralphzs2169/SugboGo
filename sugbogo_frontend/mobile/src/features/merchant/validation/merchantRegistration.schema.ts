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
  id: z.number().optional(),
  uri: z.string(),
  fileName: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
});

const businessDocumentSchema = z.object({
  id: z.number().optional(),
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
  businessName: z
    .string()
    .trim()
    .min(3, "Business name must be at least 3 characters."),

  businessCluster: z.string().min(1, "Business cluster is required."),

  businessCategory: z.string().min(1, "Business category is required."),

  businessDescription: z
    .string()
    .trim()
    .min(10, "Business description must be at least 10 characters."),

  contactNumber: z
    .string()
    .trim()
    .min(1, "Contact number is required.")
    .regex(/^(09\d{9}|\+639\d{9})$/, "Enter a valid Philippine mobile number."),

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
    .min(2, "Representative name must be at least 2 characters."),

  representativeRole: z
    .enum(["", "owner", "manager", "authorized_representative", "other"], {
      message: "Please select your role.",
    })
    .refine((value) => value !== "", {
      message: "Please select your role.",
    }),

  // Business Location
  province: z.string().trim().min(2, "Province must be at least 2 characters."),

  city: z
    .string()
    .trim()
    .min(2, "City / Municipality must be at least 2 characters."),

  barangay: z.string().trim().min(2, "Barangay must be at least 2 characters."),

  streetAddress: z
    .string()
    .trim()
    .min(5, "Street address must be at least 5 characters."),

  unit: z.string(),

  landmarks: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        address: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        source: z.enum(["google", "custom"]),
        placeId: z.string().optional(),
      }),
    )
    .max(5, "You can only add up to 5 landmarks."),

  latitude: z
    .number()
    .nullable()
    .refine((value) => value !== null, {
      message: "Business location is required.",
    }),

  longitude: z
    .number()
    .nullable()
    .refine((value) => value !== null, {
      message: "Business location is required.",
    }),

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

export type MerchantRegistrationLandmark =
  MerchantRegistrationForm["landmarks"][number];
