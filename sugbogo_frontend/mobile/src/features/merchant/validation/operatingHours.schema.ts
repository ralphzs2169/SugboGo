import { z } from "zod";

export const operatingHoursDaySchema = z
  .object({
    isOpen: z.boolean(),
    is24Hours: z.boolean(),
    openTime: z.string(),
    closeTime: z.string(),
  })
  .superRefine((day, ctx) => {
    if (!day.isOpen || day.is24Hours) {
      return;
    }

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

    if (day.openTime && day.closeTime && day.openTime === day.closeTime) {
      ctx.addIssue({
        code: "custom",
        path: ["closeTime"],
        message: "Closing time must be different from opening time.",
      });
    }
  });

export const operatingHoursSchema = z
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
    if (!Object.values(hours).some((day) => day.isOpen)) {
      ctx.addIssue({
        code: "custom",
        path: [],
        message: "At least one day must be open.",
      });
    }
  });

export type OperatingHours = z.infer<typeof operatingHoursSchema>;
export type OperatingHoursDay = z.infer<typeof operatingHoursDaySchema>;
export type OperatingHoursForm = {
  operatingHours: OperatingHours;
};
