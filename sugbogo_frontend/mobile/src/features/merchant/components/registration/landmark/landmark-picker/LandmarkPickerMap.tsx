import { View } from "react-native";
import { Circle, MapPressEvent, Marker } from "react-native-maps";

import LandmarkMap from "../LanmarkMap";
import MapMarker from "@/shared/components/MapMarker";
import {
  BusinessLandmark,
  BusinessLocation,
} from "@/shared/types/BusinessLocation.types";
import { LANDMARK_RADIUS_METERS } from "@/features/merchant/constants/registration/map.constants";

type LandmarkPickerMapProps = {
  businessLocation: BusinessLocation;
  selectedLandmarks: BusinessLandmark[];
  customLocation: {
    latitude: number;
    longitude: number;
  } | null;
  onMapPress: (event: MapPressEvent) => void;
  onExistingMarkerPress: () => void;
};

/**
 * Displays the interactive map used when creating a custom landmark.
 *
 * Uses the shared landmark map for the business and existing landmark
 * markers, while adding picker-specific behavior such as the allowed
 * selection radius and pending custom landmark.
 */
export default function LandmarkPickerMap({
  businessLocation,
  selectedLandmarks,
  customLocation,
  onMapPress,
  onExistingMarkerPress,
}: LandmarkPickerMapProps) {
  return (
    <LandmarkMap
      businessLocation={businessLocation}
      selectedLandmarks={selectedLandmarks}
      onMapPress={onMapPress}
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
          title="New Landmark"
          onPress={onExistingMarkerPress}
        >
          <View collapsable={false}>
            <MapMarker variant="pending" />
          </View>
        </Marker>
      )}
    </LandmarkMap>
  );
}
