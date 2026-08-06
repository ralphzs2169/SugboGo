import { z } from "zod";

import { merchantRegistrationSchema } from "@/features/merchant/validation/merchantRegistration.schema";

import { ApplicationOperatingHoursPayload } from "@/features/merchant/types/registration/registrationApi.types";

type MerchantRegistrationFormInput = z.input<typeof merchantRegistrationSchema>;

/**
 * Builds the operating-hours payload expected by the merchant
 * application API from the registration form values.
 */
export default function buildOperatingHoursPayload(
  values: MerchantRegistrationFormInput,
): ApplicationOperatingHoursPayload {
  return {
    hours: Object.entries(values.operatingHours).map(([day, schedule]) => ({
      day: day as ApplicationOperatingHoursPayload["hours"][number]["day"],
      is_open: schedule.isOpen,
      is_24_hours: schedule.is24Hours,
      open_time: schedule.openTime || null,
      close_time: schedule.closeTime || null,
    })),
  };
}
