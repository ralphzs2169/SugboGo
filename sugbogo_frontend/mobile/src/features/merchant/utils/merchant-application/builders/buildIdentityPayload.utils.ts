import { z } from "zod";

import { merchantRegistrationSchema } from "../../../validation/merchantRegistration.schema";
import { ApplicationIdentityPayload } from "../../../types/registration/registrationApi.types";
import { normalizeIdentity } from "../normalizers/normalizeIdentity.utils";

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
  const identity = normalizeIdentity(values);

  if (identity.representativeRole === "") {
    throw new Error("Representative role is required.");
  }

  return {
    business_name: identity.businessName,
    business_description: identity.businessDescription,
    contact_number: identity.contactNumber,
    business_email: identity.businessEmail,
    website: identity.website,
    representative_name: identity.representativeName,
    representative_role: identity.representativeRole,
    business_cluster_id: identity.businessClusterId,
    business_category_id: identity.businessCategoryId,
    specialty_tags: identity.specialtyTags,
  };
}
