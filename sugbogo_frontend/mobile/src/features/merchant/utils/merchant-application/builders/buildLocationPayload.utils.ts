import { z } from "zod";

import { merchantRegistrationSchema } from "../../../validation/merchantRegistration.schema";

import { ApplicationLocationPayload } from "../../../types/registration/registrationApi.types";

type MerchantRegistrationFormInput = z.input<typeof merchantRegistrationSchema>;

/**
 * Builds the Step 2 API payload from the registration form values.
 */
export function buildLocationPayload(
  values: MerchantRegistrationFormInput,
): ApplicationLocationPayload {
  if (values.latitude === null || values.longitude === null) {
    throw new Error("Business location is required.");
  }

  return {
    province: values.province,
    city: values.city,
    barangay: values.barangay,
    street_address: values.streetAddress,
    unit: values.unit,
    latitude: values.latitude,
    longitude: values.longitude,
    landmarks: values.landmarks.map((landmark) => ({
      name: landmark.name,
      address: landmark.address,
      latitude: landmark.latitude,
      longitude: landmark.longitude,
      source: landmark.source,
      place_id: landmark.placeId,
    })),
  };
}
