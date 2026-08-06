import { z } from "zod";

import { merchantRegistrationSchema } from "../../../validation/merchantRegistration.schema";
import { normalizeOptionalText } from "../normalizeOptionalText.utils";
import { normalizePhilippineMobileNumber } from "../phoneNumber.utils";

type MerchantRegistrationFormInput = z.input<typeof merchantRegistrationSchema>;

/**
 * Produces a normalized Business Identity snapshot from the
 * registration form.
 *
 * The snapshot is used for change detection and payload building.
 */
export function normalizeIdentity(values: MerchantRegistrationFormInput) {
  return {
    businessName: values.businessName,
    businessDescription: normalizeOptionalText(values.businessDescription),

    contactNumber: normalizePhilippineMobileNumber(values.contactNumber),

    businessEmail: normalizeOptionalText(values.businessEmail),
    website: normalizeOptionalText(values.website),

    representativeName: values.representativeName,
    representativeRole: values.representativeRole,

    businessClusterId: Number(values.businessCluster),
    businessCategoryId: Number(values.businessCategory),

    specialtyTags: [...values.specialtyTags].sort((a, b) => a - b),
  };
}

export type NormalizedIdentity = ReturnType<typeof normalizeIdentity>;
