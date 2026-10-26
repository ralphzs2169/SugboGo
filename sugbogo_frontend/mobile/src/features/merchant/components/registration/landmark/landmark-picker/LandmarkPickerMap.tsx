import { View } from "react-native";
import {
  Circle,
  Marker,
  type MapPressEvent,
  type Region,
} from "react-native-maps";

import { theme } from "@/constants/theme";
import { LANDMARK_RADIUS_METERS } from "@/features/merchant/constants/registration/map.constants";
import MapMarker from "@/shared/components/MapMarker";
import MapMarkerCallout from "@/shared/components/MapMarkerCallout";
import type {
  BusinessLandmark,
  BusinessLocation,
} from "@/shared/types/BusinessLocation.types";

import LandmarkMap from "../LanmarkMap";

type LandmarkPickerMapProps = {
  businessLocation: BusinessLocation;
  selectedLandmarks: BusinessLandmark[];
  customLocation: {
    latitude: number;
    longitude: number;
  } | null;
  landmarkName: string;
  onMapPress: (event: MapPressEvent) => void;
  onRegionChangeComplete: (region: Region) => void;
  onExistingMarkerPress: () => void;
};

/**
 * Displays the interactive map used when creating a custom landmark.
 *
 * Shows the permitted selection radius, existing landmark references, and the
 * pending custom landmark using SugboGo's shared map-marker language.
 */
export default function LandmarkPickerMap({
  businessLocation,
  selectedLandmarks,
  customLocation,
  landmarkName,
  onMapPress,
  onRegionChangeComplete,
  onExistingMarkerPress,
}: LandmarkPickerMapProps) {
  return (
    <LandmarkMap
      businessLocation={businessLocation}
      selectedLandmarks={selectedLandmarks}
      onMapPress={onMapPress}
      onRegionChangeComplete={onRegionChangeComplete}
      onLandmarkPress={onExistingMarkerPress}
    >
      {/* Landmark selection area */}
      <Circle
        center={{
          latitude: businessLocation.latitude,
          longitude: businessLocation.longitude,
        }}
        radius={LANDMARK_RADIUS_METERS}
        strokeWidth={2}
        strokeColor="#1B4D3E"
        fillColor="rgba(27, 77, 62, 0.10)"
      />

      {/* Pending custom landmark */}
      {customLocation && (
        <Marker
          coordinate={customLocation}
          anchor={{ x: 0.5, y: 1 }}
          onPress={onExistingMarkerPress}
        >
          <View collapsable={false}>
            <MapMarker variant="pending" />
          </View>

          <MapMarkerCallout
            label="New landmark"
            title={landmarkName.trim() || "Selected location"}
            description="Custom landmark awaiting confirmation"
            labelColor={theme.extends.colors.brand}
          />
        </Marker>
      )}
    </LandmarkMap>
  );
}
