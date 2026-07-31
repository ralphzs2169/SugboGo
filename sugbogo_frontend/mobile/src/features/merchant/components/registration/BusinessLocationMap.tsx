import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import MapView, {
  MapPressEvent,
  Marker,
  PROVIDER_GOOGLE,
} from "react-native-maps";

type BusinessLocationMapProps = {
  latitude: number | null;
  longitude: number | null;
  onOpenPicker?: () => void;
  onLocationSelect?: (latitude: number, longitude: number) => void;
  fullScreen?: boolean;
};

const PREVIEW_MAP_HEIGHT = 256;
const SELECTED_LOCATION_DELTA = 0.01;
const INITIAL_LOCATION_DELTA = 0.05;
const MAP_ANIMATION_DURATION = 500;

const DEFAULT_MAP_REGION = {
  latitude: 10.3157,
  longitude: 123.8854,
  latitudeDelta: INITIAL_LOCATION_DELTA,
  longitudeDelta: INITIAL_LOCATION_DELTA,
};

/**
 * Displays a Google Map for the business location flow.
 *
 * In preview mode, the map is non-interactive and tapping it
 * opens the full-screen location picker.
 *
 * In picker mode, the map becomes interactive and allows users
 * to select a location by tapping the map.
 *
 * When selected coordinates are provided, the map automatically
 * centers on the selected location.
 */
export default function BusinessLocationMap({
  latitude,
  longitude,
  onOpenPicker,
  onLocationSelect,
  fullScreen = false,
}: BusinessLocationMapProps) {
  const mapRef = useRef<MapView>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Determine whether a location has already been selected.
  const hasSelectedLocation = latitude !== null && longitude !== null;

  function handleMapPress(event: MapPressEvent) {
    if (!onLocationSelect) {
      return;
    }

    const { latitude, longitude } = event.nativeEvent.coordinate;

    onLocationSelect(latitude, longitude);
  }

  // Center the map on the currently selected business location.
  function moveToSelectedLocation() {
    if (
      !isMapReady ||
      !mapRef.current ||
      latitude === null ||
      longitude === null
    ) {
      return;
    }

    mapRef.current.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: SELECTED_LOCATION_DELTA,
        longitudeDelta: SELECTED_LOCATION_DELTA,
      },
      MAP_ANIMATION_DURATION,
    );
  }

  // Recenter the map whenever the selected location or map readiness changes.
  useEffect(() => {
    moveToSelectedLocation();
  }, [latitude, longitude, isMapReady]);

  const map = (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      pointerEvents={onLocationSelect ? "auto" : "none"}
      style={{
        width: "100%",
        height: fullScreen ? "100%" : PREVIEW_MAP_HEIGHT,
      }}
      onMapReady={() => setIsMapReady(true)}
      onPress={handleMapPress}
      initialRegion={DEFAULT_MAP_REGION}
    >
      {hasSelectedLocation && (
        <Marker
          coordinate={{
            latitude,
            longitude,
          }}
        />
      )}
    </MapView>
  );

  // In preview mode, tapping the map opens the full-screen picker.
  if (onOpenPicker) {
    return (
      <Pressable onPress={onOpenPicker}>
        <View className="relative">
          {map}

          <View pointerEvents="none" className="absolute inset-0 bg-black/20" />

          <View
            pointerEvents="none"
            className="absolute inset-0 items-center justify-center"
          >
            <View className="rounded-md bg-white/90 px-5 py-4 shadow-md">
              <Text className="text-center text-base font-semibold text-text-primary">
                {hasSelectedLocation
                  ? "Business location selected"
                  : "Select your business location"}
              </Text>

              <Text className="mt-1 text-center text-sm text-text-secondary">
                {hasSelectedLocation
                  ? "Tap to change your location"
                  : "Tap to search or choose a location"}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  return map;
}
