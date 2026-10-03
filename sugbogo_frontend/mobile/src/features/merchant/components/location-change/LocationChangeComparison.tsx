import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import LocationPickerMap from "../registration/location/LocationPickerMap";
import type { LocationChangeLocation } from "../../types/locationChange.types";

type DisplayLandmark = {
  name: string;
  address: string;
};

/** Shows a captured or proposed location with the familiar map and landmark language. */
export default function LocationChangeComparison({
  title,
  location,
  landmarks,
}: {
  title: string;
  location: LocationChangeLocation;
  landmarks: DisplayLandmark[];
}) {
  return (
    <View className="rounded-card border border-border-primary bg-surface p-4">
      {/* Location identity and pin */}
      <AppText weight="bold" className="text-base text-text-primary">
        {title}
      </AppText>
      <AppText className="mt-2 text-sm leading-5 text-text-primary">
        {location.address}
      </AppText>
      <AppText className="mt-1 text-xs text-text-secondary">
        {location.city}, {location.province}
        {location.postal_code ? ` ${location.postal_code}` : ""}
      </AppText>
      <View className="mt-3 overflow-hidden rounded-2xl">
        <LocationPickerMap
          latitude={location.latitude}
          longitude={location.longitude}
          interactionEnabled={false}
          showLocationPreviewOverlay={false}
        />
      </View>
      <AppText className="mt-2 text-xs text-text-secondary">
        Pin: {location.latitude}, {location.longitude}
      </AppText>

      {/* Complete landmark set */}
      <AppText weight="semibold" className="mt-4 text-sm text-text-primary">
        Landmarks ({landmarks.length})
      </AppText>
      {landmarks.length > 0 ? (
        landmarks.map((landmark, index) => (
          <View key={`${landmark.name}-${index}`} className="mt-2">
            <AppText className="text-sm text-text-primary">
              {landmark.name}
            </AppText>
            {landmark.address ? (
              <AppText className="text-xs text-text-secondary">
                {landmark.address}
              </AppText>
            ) : null}
          </View>
        ))
      ) : (
        <AppText className="mt-2 text-sm text-text-secondary">
          No landmarks selected
        </AppText>
      )}
    </View>
  );
}
