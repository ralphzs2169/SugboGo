import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

import { theme } from "@/constants/theme";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { MAP_STYLE } from "@/features/merchant/constants/registration/map.constants";
import MapMarker from "@/shared/components/MapMarker";
import MapMarkerCallout from "@/shared/components/MapMarkerCallout";

import type { RoadRoute } from "../../types/roadRoute.types";
import { decodeGooglePolyline } from "../../utils/roadRoute.utils";

type Props = {
  route: RoadRoute;
  businessName: string;
  businessCoverPhotoUrl: string | null;
};

const INITIAL_DELTA = 0.05;

const ROUTE_EDGE_PADDING = {
  top: 140,
  right: 44,
  bottom: 56,
  left: 44,
};

const ROUTE_COLOR = theme.extends.colors.brand;
const EXPLORER_MARKER_COLOR = theme.extends.colors.brand;
const DESTINATION_MARKER_COLOR = theme.extends.colors.brand;

const CAMERA_FOCUS_DURATION = 300;

/**
 * Displays a road-following driving route on an interactive full-screen map.
 *
 * Uses the shared Explorer and destination marker language while fitting the
 * complete road geometry and allowing either trip endpoint to be focused.
 */
export default function RoadRouteMap({
  route,
  businessName,
  businessCoverPhotoUrl,
}: Props) {
  const avatarUrl = useAuthStore((state) => state.user?.avatar_url ?? null);
  const avatarKey = useAuthStore((state) => state.user?.avatar_key ?? null);

  const mapRef = useRef<MapView>(null);
  const fittedPolylineRef = useRef<string | null>(null);

  const [isMapReady, setIsMapReady] = useState(false);

  const routeCoordinates = useMemo(
    () => decodeGooglePolyline(route.encoded_polyline),
    [route.encoded_polyline],
  );

  const fitRouteOnce = useCallback(() => {
    if (
      !isMapReady ||
      !mapRef.current ||
      routeCoordinates.length === 0 ||
      fittedPolylineRef.current === route.encoded_polyline
    ) {
      return;
    }

    fittedPolylineRef.current = route.encoded_polyline;

    mapRef.current.fitToCoordinates(
      [route.origin, ...routeCoordinates, route.destination],
      {
        edgePadding: ROUTE_EDGE_PADDING,
        animated: true,
      },
    );
  }, [
    isMapReady,
    route.destination,
    route.encoded_polyline,
    route.origin,
    routeCoordinates,
  ]);

  const focusMarker = useCallback(
    (coordinate: { latitude: number; longitude: number }) => {
      mapRef.current?.animateCamera(
        {
          center: coordinate,
        },
        {
          duration: CAMERA_FOCUS_DURATION,
        },
      );
    },
    [],
  );

  useEffect(() => {
    fitRouteOnce();
  }, [fitRouteOnce]);

  return (
    <View className="flex-1">
      {/* Road route map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        customMapStyle={MAP_STYLE}
        style={{
          width: "100%",
          height: "100%",
        }}
        initialRegion={{
          latitude: route.origin.latitude,
          longitude: route.origin.longitude,
          latitudeDelta: INITIAL_DELTA,
          longitudeDelta: INITIAL_DELTA,
        }}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onMapReady={() => {
          setIsMapReady(true);
        }}
        onMapLoaded={fitRouteOnce}
        {...(Platform.OS === "android" && {
          mapId: process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID,
        })}
      >
        {/* Selected road route */}
        <Polyline
          testID="road-route-polyline"
          coordinates={routeCoordinates}
          strokeColor={ROUTE_COLOR}
          strokeWidth={7}
          lineCap="round"
          lineJoin="round"
          zIndex={1}
        />

        {/* Explorer origin */}
        <Marker
          testID="explorer-location-marker"
          coordinate={route.origin}
          anchor={{ x: 0.5, y: 1 }}
          onPress={() => {
            focusMarker(route.origin);
          }}
        >
          <View collapsable={false}>
            <MapMarker
              variant="explorer"
              imageUrl={avatarUrl}
              avatarKey={avatarKey}
            />
          </View>

          <MapMarkerCallout
            label="Current location"
            title="Your location"
            labelColor={EXPLORER_MARKER_COLOR}
          />
        </Marker>

        {/* Business destination */}
        <Marker
          testID="business-destination-marker"
          coordinate={route.destination}
          anchor={{ x: 0.5, y: 1 }}
          onPress={() => {
            focusMarker(route.destination);
          }}
        >
          <View collapsable={false}>
            <MapMarker variant="destination" imageUrl={businessCoverPhotoUrl} />
          </View>

          <MapMarkerCallout
            label="Destination"
            title={businessName}
            labelColor={DESTINATION_MARKER_COLOR}
          />
        </Marker>
      </MapView>
    </View>
  );
}
