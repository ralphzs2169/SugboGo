import { z } from "zod";

import { merchantRegistrationSchema } from "@/features/merchant/validation/merchantRegistration.schema";

type MerchantRegistrationFormInput = z.input<typeof merchantRegistrationSchema>;

export type NormalizedOperatingHours = {
  hours: {
    day: keyof MerchantRegistrationFormInput["operatingHours"];
    isOpen: boolean;
    is24Hours: boolean;
    openTime: string | null;
    closeTime: string | null;
  }[];
};

/**
 * Produces a normalized operating-hours snapshot from the
 * registration form.
 *
 * The snapshot is used only for change detection.
 */
export function normalizeOperatingHours(
  values: MerchantRegistrationFormInput,
): NormalizedOperatingHours {
  return {
    hours: Object.entries(values.operatingHours).map(([day, schedule]) => ({
      day: day as keyof MerchantRegistrationFormInput["operatingHours"],
      isOpen: schedule.isOpen,
      is24Hours: schedule.is24Hours,
      openTime: schedule.openTime || null,
      closeTime: schedule.closeTime || null,
    })),
  };
}
