import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator } from "react-native";
import MapView, {
  MapPressEvent,
  Marker,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import { theme } from "@/constants/theme";

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

  // Prevent map animations triggered by a selected location from
  // being treated as a user-initiated map press.
  const isMapPressGuardActive = useRef(false);
  const mapPressGuardTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  function handleMapPress(event: MapPressEvent) {
    // Ignore map presses while the map is being moved programmatically
    // to prevent the animation from triggering another location selection.
    if (isMapPressGuardActive.current) {
      return;
    }

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

    // Temporarily ignore map presses while the map animates to the
    // selected location to prevent the animation from triggering
    // an unintended location selection.
    isMapPressGuardActive.current = true;

    mapRef.current.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: SELECTED_LOCATION_DELTA,
        longitudeDelta: SELECTED_LOCATION_DELTA,
      },
      MAP_ANIMATION_DURATION,
    );

    // Keep the guard active slightly longer than the animation to
    // account for the map event being dispatched after the animation.
    setTimeout(() => {
      isMapPressGuardActive.current = false;
    }, MAP_ANIMATION_DURATION + 100);
  }

  // Clear any previous guard timeout before starting a new one.
  if (mapPressGuardTimeout.current) {
    clearTimeout(mapPressGuardTimeout.current);
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
        {({ pressed }) => (
          <View
            className="relative overflow-hidden rounded-2xl"
            style={{ opacity: pressed ? 0.85 : 1 }}
          >
            {map}

            {!isMapReady && (
              <View className="absolute inset-0 items-center justify-center bg-gray-100">
                <ActivityIndicator
                  size="small"
                  color={theme.extends.colors.brand}
                />
              </View>
            )}

            {hasSelectedLocation ? (
              // Selected: keep the map visible, just a bottom gradient chip
              // confirming the pin and inviting a change.
              <View className="absolute inset-x-0 bottom-0 flex-row items-center justify-between bg-black/55 px-4 py-3">
                <View className="flex-row items-center gap-2">
                  <MaterialCommunityIcons
                    name="map-marker-check"
                    size={18}
                    color="#4ADE80"
                  />
                  <Text className="text-[13px] font-semibold text-white">
                    Location pinned
                  </Text>
                </View>

                <Text className="text-[13px] font-medium text-white/80">
                  Change
                </Text>
              </View>
            ) : (
              // Empty: dim the whole map and prompt clearly, since there's
              // nothing meaningful to look at yet.
              <>
                <View
                  pointerEvents="none"
                  className="absolute inset-0 bg-black/35"
                />

                <View
                  pointerEvents="none"
                  className="absolute inset-0 items-center justify-center px-6"
                >
                  <View className="items-center rounded-xl bg-white/95 px-5 py-4 shadow-md">
                    <MaterialCommunityIcons
                      name="map-marker-plus-outline"
                      size={26}
                      color="#1B4D3E"
                    />
                    <Text className="mt-1 text-center text-base font-semibold text-text-primary">
                      Select your business location
                    </Text>
                    <Text className="mt-0.5 text-center text-sm text-text-secondary">
                      Tap to search or choose on the map
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        )}
      </Pressable>
    );
  }

  return map;
}
