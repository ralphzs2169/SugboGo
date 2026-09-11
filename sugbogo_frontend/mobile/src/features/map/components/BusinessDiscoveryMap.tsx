import type { LocationObject } from "expo-location";
import { useEffect, useRef } from "react";
import { Platform, View } from "react-native";
import ClusteredMapView from "react-native-map-clustering";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import { theme } from "@/constants/theme";
import { MAP_STYLE } from "@/features/merchant/constants/registration/map.constants";
import MapMarker from "@/shared/components/MapMarker";

export type BusinessMapMarker = {
  id: number;
  latitude: number;
  longitude: number;
};

type Props = {
  businesses: BusinessMapMarker[];
  userLocation: LocationObject | null;
  interactive?: boolean;
  onBusinessPress?: (businessId: number) => void;
};

const DEFAULT_REGION = {
  latitude: 10.3157,
  longitude: 123.8854,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const USER_REGION_DELTA = 0.06;

/**
 * Displays business locations on a reusable clustered discovery map.
 *
 * Nearby business markers are automatically grouped into clusters as map
 * density increases. The map can operate as either an interactive discovery
 * surface or a read-only preview while independently showing user location.
 */
export default function BusinessDiscoveryMap({
  businesses,
  userLocation,
  interactive = true,
  onBusinessPress,
}: Props) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!userLocation) {
      return;
    }

    mapRef.current?.animateToRegion(
      {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: USER_REGION_DELTA,
        longitudeDelta: USER_REGION_DELTA,
      },
      500,
    );
  }, [userLocation]);

  return (
    <View className="flex-1 overflow-hidden">
      {/* Clustered discovery map */}
      <ClusteredMapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        customMapStyle={MAP_STYLE}
        initialRegion={DEFAULT_REGION}
        style={{
          width: "100%",
          height: "100%",
        }}
        pointerEvents={interactive ? "auto" : "none"}
        showsUserLocation={userLocation !== null}
        showsMyLocationButton={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        toolbarEnabled={false}
        clusteringEnabled
        clusterColor={theme.extends.colors.brand}
        clusterTextColor="#FFFFFF"
        tracksViewChanges={false}
        {...(Platform.OS === "android" && {
          mapId: process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID,
        })}
      >
        {/* Business locations */}
        {businesses.map((business) => (
          <Marker
            key={business.id}
            coordinate={{
              latitude: business.latitude,
              longitude: business.longitude,
            }}
            tracksViewChanges={false}
            onPress={() => {
              onBusinessPress?.(business.id);
            }}
          >
            <View collapsable={false}>
              <MapMarker variant="business" />
            </View>
          </Marker>
        ))}
      </ClusteredMapView>
    </View>
  );
}
