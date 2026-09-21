import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import MapView, {
  type MapPressEvent,
  Marker,
  PROVIDER_GOOGLE,
} from "react-native-maps";

import { MAP_STYLE } from "@/features/merchant/constants/registration/map.constants";
import MapMarker from "@/shared/components/MapMarker";
import MapMarkerCallout from "@/shared/components/MapMarkerCallout";

import type { JourneyOrigin } from "../../types/journeyOrigin.types";

type Props = {
  origin: JourneyOrigin | null;
  onLocationSelect: (latitude: number, longitude: number) => void;
};

const DEFAULT_REGION = {
  latitude: 10.3157,
  longitude: 123.8854,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const SELECTED_DELTA = 0.012;
const CAMERA_DURATION_MS = 400;

/**
 * Provides the map-first surface for drafting an Explorer journey origin.
 *
 * Taps and marker drags update local picker state while programmatic camera
 * moves are guarded from accidentally selecting another point.
 */
export default function JourneyOriginPickerMap({
  origin,
  onLocationSelect,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const cameraGuardRef = useRef(false);
  const cameraGuardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [isMapReady, setIsMapReady] = useState(false);

  const moveToOrigin = useCallback(() => {
    if (!isMapReady || !mapRef.current || !origin) {
      return;
    }

    cameraGuardRef.current = true;

    if (cameraGuardTimerRef.current) {
      clearTimeout(cameraGuardTimerRef.current);
    }

    mapRef.current.animateToRegion(
      {
        latitude: origin.latitude,
        longitude: origin.longitude,
        latitudeDelta: SELECTED_DELTA,
        longitudeDelta: SELECTED_DELTA,
      },
      CAMERA_DURATION_MS,
    );

    cameraGuardTimerRef.current = setTimeout(() => {
      cameraGuardRef.current = false;
    }, CAMERA_DURATION_MS + 100);
  }, [isMapReady, origin]);

  const handleMapPress = (event: MapPressEvent) => {
    if (cameraGuardRef.current) {
      return;
    }

    const { latitude, longitude } = event.nativeEvent.coordinate;

    onLocationSelect(latitude, longitude);
  };

  useEffect(() => {
    moveToOrigin();
  }, [moveToOrigin]);

  useEffect(() => {
    return () => {
      if (cameraGuardTimerRef.current) {
        clearTimeout(cameraGuardTimerRef.current);
      }
    };
  }, []);

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      customMapStyle={MAP_STYLE}
      style={{
        width: "100%",
        height: "100%",
      }}
      initialRegion={
        origin
          ? {
              latitude: origin.latitude,
              longitude: origin.longitude,
              latitudeDelta: SELECTED_DELTA,
              longitudeDelta: SELECTED_DELTA,
            }
          : DEFAULT_REGION
      }
      mapPadding={{
        top: 130,
        right: 24,
        bottom: 245,
        left: 24,
      }}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      onMapReady={() => setIsMapReady(true)}
      onPress={handleMapPress}
      {...(Platform.OS === "android" && {
        mapId: process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID,
      })}
    >
      {/* Draft starting-point marker */}
      {origin && (
        <Marker
          testID="journey-origin-marker"
          coordinate={origin}
          draggable
          anchor={{ x: 0.5, y: 1 }}
          onDragEnd={(event) => {
            const { latitude, longitude } = event.nativeEvent.coordinate;

            onLocationSelect(latitude, longitude);
          }}
        >
          <View collapsable={false}>
            <MapMarker variant="origin" />
          </View>

          <MapMarkerCallout label="Starting point" title={origin.label} />
        </Marker>
      )}
    </MapView>
  );
}
