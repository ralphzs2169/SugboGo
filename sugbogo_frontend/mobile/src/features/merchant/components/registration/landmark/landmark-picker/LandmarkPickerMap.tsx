import { View } from "react-native";
import MapView, {
  Circle,
  MapPressEvent,
  Marker,
  PROVIDER_GOOGLE,
} from "react-native-maps";

import MapMarker from "@/shared/components/MapMarker";
import {
  BusinessLandmark,
  BusinessLocation,
} from "@/shared/types/BusinessLocation.types";
import { MAP_STYLE } from "@/features/merchant/constants/map.constants";
import { LANDMARK_RADIUS_METERS } from "@/features/merchant/constants/map.constants";

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

const MAP_LATITUDE_DELTA = 0.025;
const MAP_LONGITUDE_DELTA = 0.025;

/**
 * Displays the interactive map used when creating a custom landmark.
 *
 * Shows the merchant's business location, the allowed landmark radius,
 * previously selected landmarks for reference, and the pending custom
 * landmark while allowing new locations to be placed by tapping the map.
 */
export default function LandmarkPickerMap({
  businessLocation,
  selectedLandmarks,
  customLocation,
  onMapPress,
  onExistingMarkerPress,
}: LandmarkPickerMapProps) {
  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={{ flex: 1 }}
      customMapStyle={MAP_STYLE}
      initialRegion={{
        latitude: businessLocation.latitude,
        longitude: businessLocation.longitude,
        latitudeDelta: MAP_LATITUDE_DELTA,
        longitudeDelta: MAP_LONGITUDE_DELTA,
      }}
      onPress={onMapPress}
    >
      {/* Business location */}
      <Marker
        coordinate={{
          latitude: businessLocation.latitude,
          longitude: businessLocation.longitude,
        }}
        title="Your business"
        onPress={onExistingMarkerPress}
      >
        <View collapsable={false}>
          <MapMarker variant="business" />
        </View>
      </Marker>

      {/* 1 km landmark selection area */}
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

      {/* Previously selected landmarks */}
      {selectedLandmarks.map((landmark) => (
        <Marker
          key={landmark.id}
          coordinate={{
            latitude: landmark.latitude,
            longitude: landmark.longitude,
          }}
          title={landmark.name}
          description={landmark.address}
          onPress={onExistingMarkerPress}
        >
          <View collapsable={false}>
            <MapMarker
              variant={landmark.source === "google" ? "google" : "custom"}
            />
          </View>
        </Marker>
      ))}

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
    </MapView>
  );
}
