import { useEffect, useRef, useState } from "react";
import MapView, {
  MapPressEvent,
  Marker,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import { useIsFocused } from "expo-router";
import { View } from "react-native";
import MapMarker from "@/shared/components/MapMarker";
import { MAP_STYLE } from "@/features/merchant/constants/registration/map.constants";

import useMapPressGuard from "@/features/merchant/hooks/registration/useMapPressGuard";
import useMarkerTracksChanges from "@/features/merchant/hooks/registration/useMarkerTracksChanges";
import LocationMapPreviewOverlay from "./MapPreviewOverlay";

type LocationPickerMapProps = {
  latitude: number | null;
  longitude: number | null;
  onOpenPicker?: () => void;
  onLocationSelect?: (latitude: number, longitude: number) => void;
  fullScreen?: boolean;
  interactionEnabled?: boolean;
  showLocationPreviewOverlay?: boolean;
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
export default function LocationPickerMap({
  latitude,
  longitude,
  onOpenPicker,
  onLocationSelect,
  fullScreen = false,
  interactionEnabled = true,
  showLocationPreviewOverlay = true,
}: LocationPickerMapProps) {
  // Forces the preview map to remount (fresh native surface) each time
  // this screen regains focus — see the `key` prop below.
  const isFocused = useIsFocused();

  const mapRef = useRef<MapView>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [overlayHeight, setOverlayHeight] = useState(0);

  const hasSelectedLocation = latitude !== null && longitude !== null;

  const markerTracksChanges = useMarkerTracksChanges(hasSelectedLocation);
  const pressGuard = useMapPressGuard();

  function handleMapPress(event: MapPressEvent) {
    if (pressGuard.isGuardActive() || !onLocationSelect) {
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

    pressGuard.activate(MAP_ANIMATION_DURATION);

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
  // This handles in-screen changes (e.g. picking a new spot in the
  // full-screen picker) — it does NOT reliably handle the map being
  // revisited after navigating away and back, which is what the `key`
  // + `initialRegion` combo below is for instead.
  useEffect(() => {
    moveToSelectedLocation();
  }, [latitude, longitude, isMapReady]);

  useEffect(() => pressGuard.clear, []);

  // What the map should be centered on the moment it mounts.
  const initialRegion = hasSelectedLocation
    ? {
        latitude,
        longitude,
        latitudeDelta: SELECTED_LOCATION_DELTA,
        longitudeDelta: SELECTED_LOCATION_DELTA,
      }
    : DEFAULT_MAP_REGION;

  const mapView = (
    <MapView
      // Changing `key` forces React to fully remount the MapView whenever
      // the preview screen regains focus. This is necessary because the
      // native map surface can go stale after being backgrounded during
      // navigation (e.g. going to the full-screen picker and back) —
      // `animateToRegion` can silently fail to move a stale surface.
      // Remounting guarantees a fresh surface, and pairing it with
      // `initialRegion` means it's correctly centered from the first
      // frame, with no animation needed.
      //
      // Only applied in preview mode — the full-screen picker stays
      // mounted throughout its own interactions, so it doesn't need this.
      key={
        !fullScreen && isFocused
          ? "focused"
          : !fullScreen
            ? "unfocused"
            : undefined
      }
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      customMapStyle={MAP_STYLE}
      pointerEvents={interactionEnabled ? "auto" : "none"}
      style={{
        width: "100%",
        height: fullScreen ? "100%" : PREVIEW_MAP_HEIGHT,
      }}
      onMapReady={() => setIsMapReady(true)}
      onPress={interactionEnabled ? handleMapPress : undefined}
      initialRegion={initialRegion}
      scrollEnabled={interactionEnabled}
      zoomEnabled={interactionEnabled}
      rotateEnabled={interactionEnabled}
      pitchEnabled={interactionEnabled}
      // Tells the map how much of it is covered at the bottom (by the
      // "Location pinned" bar), so it centers pins in the visible area
      // rather than the full view, part of which is hidden behind that bar.
      mapPadding={{ top: 0, right: 0, bottom: overlayHeight, left: 0 }}
    >
      {hasSelectedLocation && (
        <Marker
          coordinate={{ latitude, longitude }}
          tracksViewChanges={markerTracksChanges}
        >
          <View collapsable={false}>
            <MapMarker variant="business" />
          </View>
        </Marker>
      )}
    </MapView>
  );

  if (onOpenPicker && showLocationPreviewOverlay) {
    return (
      <LocationMapPreviewOverlay
        isMapReady={isMapReady}
        hasSelectedLocation={hasSelectedLocation}
        onPress={onOpenPicker}
        onOverlayLayout={setOverlayHeight}
      >
        {mapView}
      </LocationMapPreviewOverlay>
    );
  }

  return mapView;
}
