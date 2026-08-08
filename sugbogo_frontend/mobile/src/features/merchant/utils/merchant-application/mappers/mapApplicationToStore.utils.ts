import type {
  BusinessLandmark,
  BusinessLocation,
} from "@/shared/types/BusinessLocation.types";

import type { ApplicationDetailResponse } from "@/features/merchant/types/registration/registrationApi.types";

type MerchantRegistrationStoreSnapshot = {
  selectedLocation: BusinessLocation | null;
  selectedAddress: {
    province: string;
    city: string;
    barangay: string;
    streetAddress: string;
    unit: string;
  } | null;
  selectedLandmarks: BusinessLandmark[];
};

/**
 * Maps an application returned by the backend into the
 * Zustand merchant-registration store shape.
 *
 * This restores the business location, editable address,
 * and selected landmarks when resuming a saved draft.
 */
export function mapApplicationToStore(
  application: ApplicationDetailResponse,
): MerchantRegistrationStoreSnapshot {
  if (!application.location) {
    return {
      selectedLocation: null,
      selectedAddress: null,
      selectedLandmarks: [],
    };
  }

  return {
    selectedLocation: {
      latitude: application.location.latitude ?? 0,
      longitude: application.location.longitude ?? 0,

      province: application.location.province,
      city: application.location.city,
      barangay: application.location.barangay,
      streetAddress: application.location.street_address,
      formattedAddress: application.location.formatted_address,
      unit: application.location.unit ?? "",
    },

    selectedAddress: {
      province: application.location.province,
      city: application.location.city,
      barangay: application.location.barangay,
      streetAddress: application.location.street_address,
      unit: application.location.unit ?? "",
    },

    selectedLandmarks: application.location.landmarks.map((landmark) => ({
      id: String(landmark.id),
      name: landmark.name,
      address: landmark.address ?? "",
      latitude: landmark.latitude ?? 0,
      longitude: landmark.longitude ?? 0,
      source: landmark.source,
      placeId: landmark.place_id ?? undefined,
      isSelected: true,
    })),
  };
}
