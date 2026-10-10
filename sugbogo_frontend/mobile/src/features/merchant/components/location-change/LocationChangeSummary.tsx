import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import type {
  LocationChangeLandmark,
  LocationChangeLocation,
} from "../../types/locationChange.types";

type SummaryLandmark = Pick<
  LocationChangeLandmark,
  "name" | "address" | "latitude" | "longitude" | "source"
> & {
  placeId?: string;
  place_id?: string | null;
};

function signature(landmark: SummaryLandmark) {
  return JSON.stringify([
    landmark.name.trim(),
    landmark.address.trim(),
    landmark.latitude,
    landmark.longitude,
    landmark.source,
    landmark.placeId ?? landmark.place_id ?? null,
  ]);
}

/** Highlights the changed location and landmark values before full inspection. */
export default function LocationChangeSummary({
  previousLocation,
  requestedLocation,
  previousLandmarks,
  requestedLandmarks,
}: {
  previousLocation: LocationChangeLocation;
  requestedLocation: LocationChangeLocation;
  previousLandmarks: SummaryLandmark[];
  requestedLandmarks: SummaryLandmark[];
}) {
  const locationChanged =
    previousLocation.latitude !== requestedLocation.latitude ||
    previousLocation.longitude !== requestedLocation.longitude ||
    previousLocation.address !== requestedLocation.address ||
    previousLocation.city !== requestedLocation.city ||
    previousLocation.province !== requestedLocation.province ||
    previousLocation.postal_code !== requestedLocation.postal_code;

  const remaining = previousLandmarks.map(signature);
  let added = 0;
  requestedLandmarks.forEach((landmark) => {
    const index = remaining.indexOf(signature(landmark));
    if (index === -1) {
      added += 1;
    } else {
      remaining.splice(index, 1);
    }
  });
  const removed = remaining.length;
  const landmarkParts = [
    added > 0 ? `${added} added` : null,
    removed > 0 ? `${removed} removed` : null,
  ].filter(Boolean);

  return (
    <View className="mb-4">
      <AppText weight="semibold" className="text-sm text-text-primary">
        What&apos;s changing
      </AppText>
      <AppText className="mt-1 text-sm text-text-secondary">
        {locationChanged
          ? "Business location or address updated"
          : "Business location and address unchanged"}
        {landmarkParts.length > 0
          ? ` · Landmarks: ${landmarkParts.join(", ")}`
          : ""}
      </AppText>
    </View>
  );
}
