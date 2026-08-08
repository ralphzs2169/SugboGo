import { z } from "zod";

import { merchantRegistrationSchema } from "../../../validation/merchantRegistration.schema";
import { normalizeOptionalText } from "../normalizeOptionalText.utils";

type MerchantRegistrationFormInput = z.input<typeof merchantRegistrationSchema>;

export type NormalizedLocation = {
  province: string;
  city: string;
  barangay: string;
  streetAddress: string;
  unit: string | null;
  latitude: number | null;
  longitude: number | null;

  landmarks: {
    name: string;
    address: string | null;
    latitude: number;
    longitude: number;
    source: "google" | "custom";
    placeId: string | null;
  }[];
};

/**
 * Normalizes the business location form values into a stable
 * structure for change detection.
 */
export function normalizeLocation(
  values: MerchantRegistrationFormInput,
): NormalizedLocation {
  return {
    province: values.province,
    city: values.city,
    barangay: values.barangay,
    streetAddress: values.streetAddress,
    unit: normalizeOptionalText(values.unit),
    latitude: values.latitude,
    longitude: values.longitude,

    landmarks: values.landmarks.map((landmark) => ({
      name: landmark.name,
      address: normalizeOptionalText(landmark.address),
      latitude: landmark.latitude,
      longitude: landmark.longitude,
      source: landmark.source,
      placeId: normalizeOptionalText(landmark.placeId),
    })),
  };
}
