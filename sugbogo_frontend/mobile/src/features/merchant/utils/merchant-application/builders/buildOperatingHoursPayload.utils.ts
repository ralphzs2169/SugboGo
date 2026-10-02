import { z } from "zod";

import { merchantRegistrationSchema } from "@/features/merchant/validation/merchantRegistration.schema";

import { ApplicationOperatingHoursPayload } from "@/features/merchant/types/registration/registrationApi.types";
import { buildHoursPayload } from "@/features/merchant/utils/operatingHours.utils";

type MerchantRegistrationFormInput = z.input<typeof merchantRegistrationSchema>;

/**
 * Builds the operating-hours payload expected by the merchant
 * application API from the registration form values.
 */
export default function buildOperatingHoursPayload(
  values: MerchantRegistrationFormInput,
): ApplicationOperatingHoursPayload {
  return buildHoursPayload(values.operatingHours);
}
