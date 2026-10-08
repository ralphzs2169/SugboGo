import type { BusinessLandmark } from "@/shared/types/BusinessLocation.types";

import type { MerchantBusinessLandmark } from "../types/merchantBusinessProfile.types";
import type {
  LocationChangeLandmark,
  LocationChangeLocation,
} from "../types/locationChange.types";

type AddressField = "address" | "city" | "province" | "postal_code";

const ADDRESS_FIELDS: { key: AddressField; label: string }[] = [
  { key: "address", label: "Address" },
  { key: "city", label: "City / Municipality" },
  { key: "province", label: "Province" },
  { key: "postal_code", label: "Postal code" },
];

function landmarkSignature(
  landmark:
    MerchantBusinessLandmark | BusinessLandmark | LocationChangeLandmark,
) {
  return JSON.stringify([
    landmark.name.trim(),
    landmark.address.trim(),
    landmark.latitude,
    landmark.longitude,
    landmark.source,
    "place_id" in landmark ? landmark.place_id : (landmark.placeId ?? null),
  ]);
}

/** Finds the visible address, pin, and landmark differences between two snapshots. */
export function getLocationReviewChanges(
  current: LocationChangeLocation,
  proposed: LocationChangeLocation,
  currentLandmarks: (MerchantBusinessLandmark | LocationChangeLandmark)[],
  proposedLandmarks: (BusinessLandmark | LocationChangeLandmark)[],
) {
  const addressChanges = ADDRESS_FIELDS.flatMap(({ key, label }) => {
    const previous = current[key]?.trim() ?? "";
    const requested = proposed[key]?.trim() ?? "";

    if (previous === requested) {
      return [];
    }

    return [{ label, previous, requested }];
  });

  const remaining = [...currentLandmarks];
  const addedLandmarks: (BusinessLandmark | LocationChangeLandmark)[] = [];

  proposedLandmarks.forEach((landmark) => {
    const matchIndex = remaining.findIndex(
      (candidate) =>
        landmarkSignature(candidate) === landmarkSignature(landmark),
    );

    if (matchIndex === -1) {
      addedLandmarks.push(landmark);
    } else {
      remaining.splice(matchIndex, 1);
    }
  });

  return {
    addressChanges,
    pinMoved:
      current.latitude !== proposed.latitude ||
      current.longitude !== proposed.longitude,
    addedLandmarks,
    removedLandmarks: remaining,
  };
}
