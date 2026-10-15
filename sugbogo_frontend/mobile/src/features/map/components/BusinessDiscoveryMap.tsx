import type { LocationObject } from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import ClusteredMapView from "react-native-map-clustering";
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  type Region,
} from "react-native-maps";

import { theme } from "@/constants/theme";
import { MAP_STYLE } from "@/features/merchant/constants/registration/map.constants";
import MapMarker from "@/shared/components/MapMarker";

import type { MapBounds } from "../types/mapDiscovery.types";
import { regionToBounds } from "../utils/mapViewport";

export type BusinessMapMarker = {
  id: number;
  latitude: number;
  longitude: number;
  is_hidden_gem?: boolean;
};

type Props = {
  businesses: BusinessMapMarker[];
  userLocation: LocationObject | null;
  interactive?: boolean;
  trackMarkerUpdates?: boolean;
  onBusinessPress?: (businessId: number) => void;
  selectedBusinessId?: number | null;
  dimUnselectedMarkers?: boolean;
  autoCenterOnLocation?: boolean;
  showsUserLocation?: boolean;
  onMapReady?: (map: MapView) => void;
  onViewportChange?: (bounds: MapBounds) => void;
  onViewportChanging?: () => void;
  onMapInteraction?: () => void;
  focusTarget?: { latitude: number; longitude: number } | null;
  previewBottomInset?: number;
  onFocusStart?: () => void;
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
  trackMarkerUpdates = false,
  onBusinessPress,
  selectedBusinessId = null,
  dimUnselectedMarkers = false,
  autoCenterOnLocation = true,
  showsUserLocation = userLocation !== null,
  onMapReady,
  onViewportChange,
  onViewportChanging,
  onMapInteraction,
  focusTarget = null,
  previewBottomInset = 0,
  onFocusStart,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const [isReady, setIsReady] = useState(false);
  const [mapHeight, setMapHeight] = useState(0);
  const boundaryReadId = useRef(0);
  const isMounted = useRef(true);
  const captureMap = useCallback((map: unknown) => {
    mapRef.current = map as MapView | null;
  }, []);

  useEffect(() => {
    if (!isReady || !mapHeight || !focusTarget) {
      return;
    }

    // Dispatch after the sheet/keyboard has restored the native map's layout.
    // A center/zoom camera command does not depend on Android bounds fitting.
    const frame = requestAnimationFrame(() => {
      onFocusStart?.();
      mapRef.current?.animateCamera(
        {
          center: focusTarget,
          zoom: 16,
          pitch: 0,
          heading: 0,
        },
        { duration: 500 },
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [focusTarget, isReady, mapHeight, onFocusStart]);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      boundaryReadId.current += 1;
    };
  }, []);

  const reportViewport = async (region: Region) => {
    if (!onViewportChange) {
      return;
    }

    const readId = ++boundaryReadId.current;
    let bounds = regionToBounds(region);

    try {
      const boundaries = await mapRef.current?.getMapBoundaries();

      if (boundaries) {
        bounds = {
          north: boundaries.northEast.latitude,
          south: boundaries.southWest.latitude,
          east: boundaries.northEast.longitude,
          west: boundaries.southWest.longitude,
        };
      }
    } catch {
      // Region deltas are the fallback for providers without native boundaries.
    }

    if (isMounted.current && readId === boundaryReadId.current) {
      onViewportChange(bounds);
    }
  };

  useEffect(() => {
    if (!autoCenterOnLocation || !userLocation) {
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
  }, [autoCenterOnLocation, userLocation]);

  return (
    <View className="flex-1 overflow-hidden">
      {/* Clustered discovery map */}
      <ClusteredMapView
        mapRef={captureMap}
        provider={PROVIDER_GOOGLE}
        customMapStyle={MAP_STYLE}
        initialRegion={DEFAULT_REGION}
        mapPadding={{ top: 0, left: 0, right: 0, bottom: previewBottomInset }}
        onLayout={(event) => setMapHeight(event.nativeEvent.layout.height)}
        onMapReady={() => {
          setIsReady(true);
          if (mapRef.current) {
            onMapReady?.(mapRef.current);
          }

          void reportViewport(DEFAULT_REGION);
        }}
        onRegionChange={(_region, details) => {
          if (details?.isGesture) {
            onMapInteraction?.();
          }
          boundaryReadId.current += 1;
          onViewportChanging?.();
        }}
        onRegionChangeComplete={(region) => {
          void reportViewport(region);
        }}
        onTouchStart={onMapInteraction}
        style={{
          width: "100%",
          height: "100%",
        }}
        pointerEvents={interactive ? "auto" : "none"}
        showsUserLocation={showsUserLocation}
        showsMyLocationButton={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        toolbarEnabled={false}
        clusteringEnabled
        clusterColor={theme.extends.colors.brand}
        clusterTextColor="#FFFFFF"
        tracksViewChanges={trackMarkerUpdates}
        {...(Platform.OS === "android" && {
          mapId: process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID,
        })}
      >
        {/* Business locations */}
        {businesses.map((business) => {
          const isSelected = selectedBusinessId === business.id;

          return (
            <Marker
              key={`${business.id}-${isSelected}-${business.is_hidden_gem === true}`}
              identifier={String(business.id)}
              {...{ cluster: !isSelected }}
              // The marker's bottom edge is the exact coordinate dot.
              anchor={{ x: 0.5, y: 1 }}
              zIndex={isSelected ? 1 : 0}
              opacity={
                dimUnselectedMarkers &&
                selectedBusinessId !== null &&
                !isSelected
                  ? 0.55
                  : 1
              }
              accessibilityState={{
                selected: isSelected,
              }}
              coordinate={{
                latitude: business.latitude,
                longitude: business.longitude,
              }}
              tracksViewChanges={trackMarkerUpdates}
              onPress={() => {
                onBusinessPress?.(business.id);
              }}
            >
              <View collapsable={false}>
                <MapMarker
                  variant={
                    business.is_hidden_gem === true ? "hidden-gem" : "business"
                  }
                  selected={isSelected}
                />
              </View>
            </Marker>
          );
        })}
      </ClusteredMapView>
    </View>
  );
}
