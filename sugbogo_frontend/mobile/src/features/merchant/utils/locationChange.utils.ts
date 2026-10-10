import type {
  MerchantBusinessLocation,
  MerchantBusinessProfileResponse,
} from "../types/merchantBusinessProfile.types";
import type {
  LocationChangeLocation,
  SubmitLocationChangePayload,
} from "../types/locationChange.types";
import type {
  BusinessLandmark,
  BusinessLocation,
} from "@/shared/types/BusinessLocation.types";

export function liveLocationProposal(
  location: MerchantBusinessLocation,
): LocationChangeLocation {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    address: location.address,
    city: location.city,
    province: location.province,
    postal_code: location.postal_code,
  };
}

export function liveLandmarkSelection(
  location: MerchantBusinessLocation,
): BusinessLandmark[] {
  return location.landmarks.map((landmark) => ({
    id: `live-${landmark.id}`,
    name: landmark.name,
    address: landmark.address,
    latitude: landmark.latitude,
    longitude: landmark.longitude,
    source: landmark.source,
    placeId: landmark.place_id ?? undefined,
  }));
}

/** Adapts a flat live address to the shared map picker's display fields. */
export function toPickerLocation(
  location: LocationChangeLocation,
): BusinessLocation {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    formattedAddress: location.address,
    city: location.city,
    province: location.province,
    barangay: "",
    streetAddress: "",
    isWithinServiceArea: true,
  };
}

export function selectedLocationProposal(
  selected: BusinessLocation,
  previous: LocationChangeLocation,
): LocationChangeLocation {
  const samePin =
    selected.latitude === previous.latitude &&
    selected.longitude === previous.longitude;
  return {
    latitude: selected.latitude,
    longitude: selected.longitude,
    address: selected.formattedAddress,
    city: selected.city,
    province: selected.province,
    postal_code: samePin ? previous.postal_code : "",
  };
}

export function buildLocationChangePayload(
  location: LocationChangeLocation,
  landmarks: BusinessLandmark[],
): Omit<SubmitLocationChangePayload, "reason"> {
  return {
    proposed_location: {
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address.trim(),
      city: location.city.trim(),
      province: location.province.trim(),
      postal_code: location.postal_code?.trim() || null,
    },
    proposed_landmarks: landmarks.map((landmark) => ({
      name: landmark.name.trim(),
      address: landmark.address.trim(),
      latitude: landmark.latitude,
      longitude: landmark.longitude,
      source: landmark.source,
      place_id: landmark.placeId || null,
    })),
  };
}

function landmarkSignature(landmark: {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  source: string;
  place_id: string | null;
}) {
  return JSON.stringify([
    landmark.name.trim(),
    landmark.address.trim(),
    landmark.longitude,
    landmark.latitude,
    landmark.source,
    landmark.place_id,
  ]);
}

/** Detects effective changes without treating landmark display order as a change. */
export function locationProposalChanged(
  business: MerchantBusinessProfileResponse,
  payload: Omit<SubmitLocationChangePayload, "reason">,
) {
  const current = liveLocationProposal(business.location);
  const proposed = payload.proposed_location;
  if (
    current.latitude !== proposed.latitude ||
    current.longitude !== proposed.longitude ||
    current.address !== proposed.address ||
    current.city !== proposed.city ||
    current.province !== proposed.province ||
    (current.postal_code || null) !== (proposed.postal_code || null)
  ) {
    return true;
  }

  const previousLandmarks = business.location.landmarks
    .map(landmarkSignature)
    .sort();
  const proposedLandmarks = payload.proposed_landmarks
    .map(landmarkSignature)
    .sort();
  return (
    previousLandmarks.length !== proposedLandmarks.length ||
    previousLandmarks.some(
      (signature, index) => signature !== proposedLandmarks[index],
    )
  );
}
