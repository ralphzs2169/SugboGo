import type { ReactNode } from "react";
import { View } from "react-native";
import MapView, {
  type MapPressEvent,
  Marker,
  PROVIDER_GOOGLE,
} from "react-native-maps";

import { theme } from "@/constants/theme";
import { MAP_STYLE } from "@/features/merchant/constants/registration/map.constants";
import MapMarker from "@/shared/components/MapMarker";
import MapMarkerCallout from "@/shared/components/MapMarkerCallout";
import type {
  BusinessLandmark,
  BusinessLocation,
} from "@/shared/types/BusinessLocation.types";

type LandmarkMapProps = {
  businessLocation: BusinessLocation;
  selectedLandmarks: BusinessLandmark[];
  onLandmarkPress?: (landmark: BusinessLandmark) => void;
  onMapPress?: (event: MapPressEvent) => void;
  children?: ReactNode;
  initialLatitudeDelta?: number;
  initialLongitudeDelta?: number;
};

const DEFAULT_MAP_DELTA = 0.014;

/**
 * Displays the merchant's business and selected landmarks on a shared map.
 *
 * Uses SugboGo's shared marker and callout presentation while keeping the
 * initial viewport focused around the current custom-landmark selection area.
 */
export default function LandmarkMap({
  businessLocation,
  selectedLandmarks,
  onLandmarkPress,
  onMapPress,
  initialLatitudeDelta = DEFAULT_MAP_DELTA,
  initialLongitudeDelta = DEFAULT_MAP_DELTA,
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
        anchor={{ x: 0.5, y: 1 }}
        onPress={(event) => {
          event.stopPropagation();
        }}
      >
        <View collapsable={false}>
          <MapMarker variant="business" />
        </View>

        <MapMarkerCallout
          label="Business location"
          title="Your business"
          labelColor={theme.extends.colors.brand}
        />
      </Marker>

      {/* Selected landmarks */}
      {selectedLandmarks.map((landmark) => (
        <Marker
          key={landmark.id}
          coordinate={{
            latitude: landmark.latitude,
            longitude: landmark.longitude,
          }}
          anchor={{ x: 0.5, y: 1 }}
          onPress={(event) => {
            event.stopPropagation();
            onLandmarkPress?.(landmark);
          }}
        >
          <View collapsable={false}>
            <MapMarker
              variant={landmark.source === "google" ? "google" : "custom"}
            />
          </View>

          <MapMarkerCallout
            label={
              landmark.source === "google"
                ? "Nearby landmark"
                : "Custom landmark"
            }
            title={landmark.name}
            description={landmark.address || undefined}
            labelColor={theme.extends.colors.brand}
          />
        </Marker>
      ))}

      {/* Map-specific content */}
      {children}
    </MapView>
  );
}
