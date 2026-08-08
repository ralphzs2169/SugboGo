import { ReactNode } from "react";
import { View } from "react-native";
import MapView, {
  MapPressEvent,
  Marker,
  PROVIDER_GOOGLE,
} from "react-native-maps";

import MapMarker from "@/shared/components/MapMarker";
import {
  BusinessLandmark,
  BusinessLocation,
} from "@/shared/types/BusinessLocation.types";
import { MAP_STYLE } from "@/features/merchant/constants/registration/map.constants";

type LandmarkMapProps = {
  businessLocation: BusinessLocation;
  selectedLandmarks: BusinessLandmark[];
  onLandmarkPress?: (landmark: BusinessLandmark) => void;
  onMapPress?: (event: MapPressEvent) => void;
  children?: ReactNode;
  initialLatitudeDelta?: number;
  initialLongitudeDelta?: number;
};

export default function LandmarkMap({
  businessLocation,
  selectedLandmarks,
  onLandmarkPress,
  onMapPress,
  initialLatitudeDelta = 0.025,
  initialLongitudeDelta = 0.025,
  children,
}: LandmarkMapProps) {
  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={{ flex: 1 }}
      customMapStyle={MAP_STYLE}
      initialRegion={{
        latitude: businessLocation.latitude,
        longitude: businessLocation.longitude,
        latitudeDelta: initialLatitudeDelta,
        longitudeDelta: initialLongitudeDelta,
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
        onPress={(event) => {
          // Prevent taps on the business marker from falling through
          // to the map's onPress and being treated as a new landmark.
          event.stopPropagation();
        }}
      >
        <View collapsable={false}>
          <MapMarker variant="business" />
        </View>
      </Marker>

      {/* Selected landmarks */}
      {selectedLandmarks.map((landmark) => (
        <Marker
          key={landmark.id}
          coordinate={{
            latitude: landmark.latitude,
            longitude: landmark.longitude,
          }}
          title={landmark.name}
          description={landmark.address || "Custom landmark"}
          onPress={() => onLandmarkPress?.(landmark)}
        >
          <View collapsable={false}>
            <MapMarker
              variant={landmark.source === "google" ? "google" : "custom"}
            />
          </View>
        </Marker>
      ))}

      {/* Map-specific content */}
      {children}
    </MapView>
  );
}
