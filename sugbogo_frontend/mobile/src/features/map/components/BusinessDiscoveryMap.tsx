import type { LocationObject } from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  cluster_icon?: string | null;
};

export type BusinessMapFocusTarget = {
  latitude: number;
  longitude: number;
  preserveZoom?: boolean;
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
  focusTarget?: BusinessMapFocusTarget | null;
  previewBottomInset?: number;
  focusInsets?: { top: number; bottom: number; ready: boolean };
  onFocusStart?: () => void;
  useClusterIcons?: boolean;
  hideNativeZoomControls?: boolean;
  manageMarkerCamera?: boolean;
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
  focusInsets,
  onFocusStart,
  useClusterIcons = false,
  hideNativeZoomControls = false,
  manageMarkerCamera = false,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const [isReady, setIsReady] = useState(false);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const dispatchedFocus = useRef<typeof focusTarget>(null);
  const mapPadding = useMemo(
    () => ({ top: 0, left: 0, right: 0, bottom: previewBottomInset }),
    [previewBottomInset],
  );
  const boundaryReadId = useRef(0);
  const isMounted = useRef(true);
  const captureMap = useCallback((map: unknown) => {
    mapRef.current = map as MapView | null;
  }, []);

  useEffect(() => {
    if (!focusTarget) {
      dispatchedFocus.current = null;
      return;
    }
    if (
      !isReady ||
      !mapSize.height ||
      (focusInsets && !focusInsets.ready) ||
      dispatchedFocus.current === focusTarget
    ) {
      return;
    }

    let cancelled = false;
    // Measure once per selection; keep native padding fixed so later preview
    // layouts cannot independently move the camera.
    const frame = requestAnimationFrame(() => {
      void (async () => {
        const map = mapRef.current;
        if (!map) return;
        let zoom: number | undefined;
        let center = {
          latitude: focusTarget.latitude,
          longitude: focusTarget.longitude,
        };
        if (!focusTarget.preserveZoom || focusInsets) {
          try {
            const camera = await map.getCamera();
            if (
              !focusTarget.preserveZoom &&
              typeof camera.zoom === "number" &&
              Number.isFinite(camera.zoom) &&
              camera.zoom < 16
            ) {
              zoom = 16;
            }
            if (focusInsets && mapSize.width) {
              const point = await map.pointForCoordinate(center);
              const cameraPoint = await map.pointForCoordinate(camera.center);
              const desiredY =
                (focusInsets.top + mapSize.height - focusInsets.bottom) / 2;
              const scale =
                zoom !== undefined && typeof camera.zoom === "number"
                  ? Math.pow(2, zoom - camera.zoom)
                  : 1;
              // Native projection respects rotation. Scale the screen offset
              // only when global search also needs to increase the zoom.
              center = await map.coordinateForPoint({
                x: point.x + (cameraPoint.x - mapSize.width / 2) / scale,
                y: point.y + (cameraPoint.y - desiredY) / scale,
              });
            }
          } catch {
            // Providers without projection support retain native centering.
          }
        }
        if (cancelled) return;
        dispatchedFocus.current = focusTarget;
        onFocusStart?.();
        map.animateCamera(
          {
            center,
            ...(zoom !== undefined && { zoom }),
          },
          { duration: 500 },
        );
      })();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [focusTarget, focusInsets, isReady, mapSize, onFocusStart]);

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
        customMapStyle={Platform.OS === "ios" ? MAP_STYLE : undefined}
        initialRegion={DEFAULT_REGION}
        mapPadding={mapPadding}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setMapSize((previous) =>
            previous.width === width && previous.height === height
              ? previous
              : { width, height },
          );
        }}
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
        moveOnMarkerPress={manageMarkerCamera ? false : undefined}
        {...(hideNativeZoomControls && {
          zoomControlEnabled: false,
          showsCompass: true,
        })}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={interactive}
        pitchEnabled={interactive}
        toolbarEnabled={false}
        clusteringEnabled
        clusterColor={theme.extends.colors.brand}
        clusterTextColor="#FFFFFF"
        tracksViewChanges={trackMarkerUpdates}
        googleMapId={
          Platform.OS === "android"
            ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID
            : undefined
        }
      >
        {/* Business locations */}
        {businesses.map((business) => {
          const isSelected = selectedBusinessId === business.id;

          return (
            <Marker
              key={`${business.id}-${isSelected}-${business.is_hidden_gem === true}${useClusterIcons ? `-${business.cluster_icon ?? ""}` : ""}`}
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
                  clusterIcon={
                    useClusterIcons
                      ? (business.cluster_icon ?? null)
                      : undefined
                  }
                />
              </View>
            </Marker>
          );
        })}
      </ClusteredMapView>
    </View>
  );
}
