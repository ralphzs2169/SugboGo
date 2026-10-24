import type { LocationObject } from "expo-location";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Image, Platform, View } from "react-native";
import ClusteredMapView from "react-native-map-clustering";
import MapView, {
  PROVIDER_GOOGLE,
  type MapMarker as NativeMapMarker,
  type Region,
} from "react-native-maps";

import { MAP_STYLE } from "@/features/merchant/constants/registration/map.constants";
import MapClusterMarker from "@/shared/components/map-related/MapClusterMarker";
import SnapshotMapMarker from "@/shared/components/map-related/SnapshotMapMarker";
import MapMarker from "@/shared/components/MapMarker";
import { MAP_MARKER_FALLBACK_IMAGE } from "@/shared/constants/mapMarkerSnapshot";

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
  isScreenFocused?: boolean;
};

type SuperClusterHandle = {
  getLeaves: (
    clusterId: number,
    limit?: number,
  ) => { properties?: { identifier?: string } }[];
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
 * Nearby business markers are grouped into clusters.
 * Clusters indicate whether they contain hidden gems.
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
  isScreenFocused,
}: Props) {
  const mapRef = useRef<MapView>(null);
  const markerRefs = useRef(new Map<string, NativeMapMarker>());
  const superClusterRef = useRef<SuperClusterHandle | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isMarkerFallbackReady, setIsMarkerFallbackReady] = useState(
    Platform.OS !== "android",
  );
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

  const dispatchedFocus = useRef<typeof focusTarget>(null);
  const boundaryReadId = useRef(0);
  const isMounted = useRef(true);
  const businessPressRef = useRef(onBusinessPress);

  useLayoutEffect(() => {
    businessPressRef.current = onBusinessPress;
  }, [onBusinessPress]);

  // Keep event updates out of the marker tree's identity. The clustering wrapper
  // rebuilds its entire index whenever its children array changes.
  const businessMarkers = useMemo(() => {
    if (!isMarkerFallbackReady) {
      return [];
    }

    return businesses.map((business) => {
      const isSelected = selectedBusinessId === business.id;

      return (
        <SnapshotMapMarker
          key={`business-${business.id}`}
          markerRef={(marker) => {
            const key = `business-${business.id}`;

            if (marker) {
              markerRefs.current.set(key, marker);
            } else {
              markerRefs.current.delete(key);
            }
          }}
          snapshotKey={`${isSelected}-${business.is_hidden_gem === true}-${useClusterIcons ? (business.cluster_icon ?? "") : ""}`}
          identifier={String(business.id)}
          {...(isSelected ? { cluster: false } : {})}
          anchor={{ x: 0.5, y: 1 }}
          zIndex={isSelected ? 1 : 0}
          opacity={
            dimUnselectedMarkers && selectedBusinessId !== null && !isSelected
              ? 0.55
              : 1
          }
          accessibilityState={{ selected: isSelected }}
          coordinate={{
            latitude: business.latitude,
            longitude: business.longitude,
          }}
          tracksViewChanges={trackMarkerUpdates}
          onPress={() => businessPressRef.current?.(business.id)}
        >
          <MapMarker
            variant={
              business.is_hidden_gem === true ? "hidden-gem" : "business"
            }
            selected={isSelected}
            clusterIcon={
              useClusterIcons ? (business.cluster_icon ?? null) : undefined
            }
          />
        </SnapshotMapMarker>
      );
    });
  }, [
    businesses,
    dimUnselectedMarkers,
    isMarkerFallbackReady,
    selectedBusinessId,
    trackMarkerUpdates,
    useClusterIcons,
  ]);

  const mapPadding = useMemo(
    () => ({ top: 0, left: 0, right: 0, bottom: previewBottomInset }),
    [previewBottomInset],
  );

  const captureMap = useCallback((map: unknown) => {
    mapRef.current = map as MapView | null;
  }, []);

  useEffect(() => {
    if (!isScreenFocused || !isReady) return;

    // Detached tabs can lose custom-marker bitmaps while JS marker state stays
    // mounted. Refresh both visible cluster and business snapshots after attach.
    const frame = requestAnimationFrame(() => {
      markerRefs.current.forEach((marker) => marker.redraw());
    });

    return () => cancelAnimationFrame(frame);
  }, [isScreenFocused, isReady]);

  // Identify hidden gems by business ID.
  const gemIds = useMemo(
    () =>
      new Set(
        businesses
          .filter((business) => business.is_hidden_gem === true)
          .map((business) => String(business.id)),
      ),
    [businesses],
  );

  // Count hidden gems within a cluster.
  const countGems = useCallback(
    (clusterId: number) => {
      if (gemIds.size === 0) return 0;

      const engine = superClusterRef.current;

      if (!engine) {
        return 0;
      }

      try {
        const leaves = engine.getLeaves(clusterId, Infinity);

        return leaves.filter((leaf) =>
          gemIds.has(String(leaf.properties?.identifier)),
        ).length;
      } catch {
        // Fall back to a regular cluster if its members cannot be resolved.
        return 0;
      }
    },
    [gemIds],
  );

  // Focus the map on a selected business.
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

              center = await map.coordinateForPoint({
                x: point.x + (cameraPoint.x - mapSize.width / 2) / scale,
                y: point.y + (cameraPoint.y - desiredY) / scale,
              });
            }
          } catch {
            // Fall back to native centering.
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
    if (!onViewportChange) return;

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
      // Use region deltas when native boundaries are unavailable.
    }

    if (isMounted.current && readId === boundaryReadId.current) {
      onViewportChange(bounds);
    }
  };

  // Center on the user's location.
  useEffect(() => {
    if (!autoCenterOnLocation || !userLocation) return;

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
      {/* Decode and retain the tiny transparent fallback before markers mount. */}
      {Platform.OS === "android" && (
        <Image
          source={MAP_MARKER_FALLBACK_IMAGE}
          accessible={false}
          onLoad={() => setIsMarkerFallbackReady(true)}
          onError={() => setIsMarkerFallbackReady(true)}
          style={{ position: "absolute", width: 1, height: 1 }}
        />
      )}
      <ClusteredMapView
        mapRef={captureMap}
        superClusterRef={superClusterRef}
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
        tracksViewChanges={trackMarkerUpdates}
        googleMapId={
          Platform.OS === "android"
            ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID
            : undefined
        }
        minPoints={3}
        radius={56}
        renderCluster={(cluster) => {
          const gemCount = countGems(
            cluster.properties.cluster_id ?? cluster.id,
          );

          return (
            <MapClusterMarker
              key={`cluster-${cluster.id}`}
              {...cluster}
              gemCount={gemCount}
              markerRef={(marker) => {
                const key = `cluster-${cluster.id}`;
                if (marker) markerRefs.current.set(key, marker);
                else markerRefs.current.delete(key);
              }}
            />
          );
        }}
      >
        {businessMarkers}
      </ClusteredMapView>
    </View>
  );
}
