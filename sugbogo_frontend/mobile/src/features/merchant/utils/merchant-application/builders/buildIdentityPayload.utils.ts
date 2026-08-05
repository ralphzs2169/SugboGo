import { z } from "zod";

import { merchantRegistrationSchema } from "../../../validation/merchantRegistration.schema";

import { ApplicationIdentityPayload } from "../../../types/merchant-application/applicationApi.types";
import { normalizePhilippineMobileNumber } from "../phoneNumber.utils";

type MerchantRegistrationFormInput = z.input<typeof merchantRegistrationSchema>;

/**
 * Builds the Step 1 API payload from the registration form values.
 *
 * Converts the frontend registration form structure into the payload
 * expected by the merchant application identity endpoint.
 */
export function buildIdentityPayload(
  values: MerchantRegistrationFormInput,
): ApplicationIdentityPayload {
  if (values.representativeRole === "") {
    throw new Error("Representative role is required.");
  }

  return {
    business_name: values.businessName,
    business_description: values.businessDescription,
    contact_number: normalizePhilippineMobileNumber(values.contactNumber),
    business_email: values.businessEmail,
    website: values.website,
    representative_name: values.representativeName,
    representative_role: values.representativeRole,
    business_cluster_id: Number(values.businessCluster),
    business_category_id: Number(values.businessCategory),
    specialty_tags: values.specialtyTags,
  };
}
