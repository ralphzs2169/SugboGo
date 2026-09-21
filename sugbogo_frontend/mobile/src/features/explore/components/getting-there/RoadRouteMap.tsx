import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, View } from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from "react-native-maps";

import { theme } from "@/constants/theme";
import { MAP_STYLE } from "@/features/merchant/constants/registration/map.constants";
import MapMarker from "@/shared/components/MapMarker";

import type { RoadRoute } from "../../types/roadRoute.types";
import { decodeGooglePolyline } from "../../utils/roadRoute.utils";

type Props = {
  route: RoadRoute;
  businessName: string;
};

const INITIAL_DELTA = 0.05;
const ROUTE_EDGE_PADDING = {
  top: 56,
  right: 44,
  bottom: 56,
  left: 44,
};

/** Displays Google's decoded road geometry with distinct trip endpoints. */
export default function RoadRouteMap({ route, businessName }: Props) {
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
        animated: false,
      },
    );
  }, [
    isMapReady,
    route.destination,
    route.encoded_polyline,
    route.origin,
    routeCoordinates,
  ]);

  useEffect(() => {
    fitRouteOnce();
  }, [fitRouteOnce]);

  return (
    <View className="flex-1 overflow-hidden rounded-card border border-border-primary">
      {/* Road-following route map */}
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
        showsUserLocation
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
        <Polyline
          coordinates={routeCoordinates}
          strokeColor={theme.extends.colors.brand}
          strokeWidth={5}
        />

        {/* Trip endpoints */}
        <Marker
          coordinate={route.origin}
          title="Your location"
          description="Road route origin"
          pinColor="#2563EB"
        />

        <Marker
          coordinate={route.destination}
          title={businessName}
          description="Road route destination"
        >
          <View collapsable={false}>
            <MapMarker variant="business" />
          </View>
        </Marker>
      </MapView>
    </View>
  );
}
