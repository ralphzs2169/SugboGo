import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import type RNMapView from "react-native-maps";
import { router, useNavigation } from "expo-router";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";
import useUserLocation from "@/shared/hooks/useUserLocation";

import BusinessDiscoveryMap from "../components/BusinessDiscoveryMap";
import MapControls from "../components/MapControls";
import MapSearchOverlay from "../components/MapSearchOverlay";
import MSMEPreviewCard from "../components/MSMEPreviewCard";
import useMapDiscovery from "../hooks/useMapDiscovery";
import useMapViewport from "../hooks/useMapViewport";
import type { MapBounds } from "../types/mapDiscovery.types";
import { isViewportLimitError } from "../utils/mapViewport";

/**
 * Discovers live businesses in explicitly searched map viewports.
 * Camera movement stays local until Search this area is pressed.
 */
export default function MapScreen() {
  const navigation = useNavigation();
  const userLocation = useUserLocation();
  const viewport = useMapViewport();
  const discovery = useMapDiscovery(viewport.committedBounds);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(
    null,
  );
  const [mapInstance, setMapInstance] = useState<RNMapView | null>(null);
  const [previewHeight, setPreviewHeight] = useState(0);
  const hasInteracted = useRef(false);
  const hasHandledInitialLocation = useRef(false);
  const searchAfterInitialCenter = useRef(false);
  const initialCenterStarted = useRef(false);
  const bottomSpacing = useTabBarSpacing(16);
  const limitError = isViewportLimitError(discovery.error);
  const { onViewportChange } = viewport;

  useQueryErrorNotification({
    error: limitError ? null : discovery.error,
    toastId: "map-discovery-error",
    title: "Could not load businesses",
    fallbackMessage: "Please try searching this area again.",
  });

  useEffect(() => {
    if (
      !mapInstance ||
      userLocation.status === "loading" ||
      hasHandledInitialLocation.current
    ) {
      return;
    }

    hasHandledInitialLocation.current = true;

    if (userLocation.location && !hasInteracted.current) {
      searchAfterInitialCenter.current = true;
      mapInstance.animateToRegion({
        latitude: userLocation.location.coords.latitude,
        longitude: userLocation.location.coords.longitude,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      });
    }
  }, [mapInstance, userLocation.location, userLocation.status]);

  const handleViewportChange = useCallback(
    (bounds: MapBounds) => {
      // Ignore a ready-time read that finishes before native centering starts.
      if (searchAfterInitialCenter.current && !initialCenterStarted.current) {
        return;
      }

      onViewportChange(bounds, searchAfterInitialCenter.current);
      searchAfterInitialCenter.current = false;
    },
    [onViewportChange],
  );

  const markers = useMemo(
    () =>
      discovery.businesses.map((business) => ({
        id: business.id,
        latitude: business.location.latitude,
        longitude: business.location.longitude,
        is_hidden_gem: business.is_hidden_gem === true,
      })),
    [discovery.businesses],
  );

  const selectedBusiness = discovery.businesses.find(
    (business) => business.id === selectedBusinessId,
  );

  // Reset vanished IDs before rendering so a later response cannot reopen them.
  if (selectedBusinessId !== null && !selectedBusiness) {
    setSelectedBusinessId(null);
  }

  const viewBusiness = () => {
    if (!selectedBusiness || !navigation.isFocused()) {
      return;
    }

    router.push({
      pathname: "/(explorer)/business/[businessId]",
      params: {
        businessId: String(selectedBusiness.id),
      },
    });
  };

  const zoom = async (amount: number) => {
    hasInteracted.current = true;

    try {
      const camera = await mapInstance?.getCamera();

      if (camera) {
        mapInstance?.animateCamera({ zoom: (camera.zoom ?? 12) + amount });
      }
    } catch {
      Alert.alert("Map unavailable", "Please try the zoom control again.");
    }
  };

  const locateMe = async () => {
    hasInteracted.current = true;

    if (userLocation.isRefreshingLocation) {
      return;
    }

    const result = await userLocation.refreshLocation();

    if (result.status !== "available") {
      Alert.alert(
        result.status === "denied"
          ? "Location Permission Needed"
          : "Location unavailable",
        "You can still explore the map. Enable location access and device location to recenter near you.",
      );
      return;
    }

    mapInstance?.animateToRegion({
      latitude: result.location.coords.latitude,
      longitude: result.location.coords.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  };

  let statusMessage: string | null = null;

  if (viewport.needsZoom || limitError) {
    statusMessage = "Zoom in to search this area";
  } else if (discovery.isFetching || !viewport.committedBounds) {
    statusMessage = "Loading businesses…";
  } else if (!discovery.error && discovery.pagination?.has_next) {
    statusMessage = `Showing ${discovery.businesses.length} of ${discovery.pagination.total_items} businesses in the searched area. Zoom in for more complete results.`;
  } else if (!discovery.error && discovery.businesses.length === 0) {
    statusMessage =
      "No businesses in the searched area. Move the map and search another area.";
  }

  return (
    <View className="flex-1">
      {/* Live clustered map and existing overlays */}
      <BusinessDiscoveryMap
        businesses={markers}
        userLocation={userLocation.location}
        showsUserLocation={userLocation.status === "available"}
        autoCenterOnLocation={false}
        onMapReady={setMapInstance}
        onViewportChange={handleViewportChange}
        onViewportChanging={() => {
          if (searchAfterInitialCenter.current) {
            initialCenterStarted.current = true;
          }

          viewport.onViewportChanging();
        }}
        onMapInteraction={() => {
          hasInteracted.current = true;
          searchAfterInitialCenter.current = false;
        }}
        onBusinessPress={setSelectedBusinessId}
        selectedBusinessId={selectedBusiness?.id ?? null}
      />
      <MapSearchOverlay />
      <MapControls
        onZoomIn={() => void zoom(1)}
        onZoomOut={() => void zoom(-1)}
        onLocateMe={() => void locateMe()}
        bottomOffset={
          selectedBusiness ? bottomSpacing + previewHeight + 12 : bottomSpacing
        }
      />

      {/* Nonblocking discovery feedback and explicit viewport search */}
      <View
        className="absolute left-md right-md gap-sm"
        style={{ bottom: bottomSpacing }}
        pointerEvents="box-none"
      >
        <View className="mr-16 gap-sm" pointerEvents="box-none">
          {viewport.canSearch && (
            <Button
              title="Search this area"
              rounded="full"
              className="self-center"
              onPress={() => {
                setSelectedBusinessId(null);
                viewport.searchThisArea();
              }}
            />
          )}

          {statusMessage && (
            <View className="flex-row items-center gap-sm rounded-card bg-surface p-md">
              {discovery.isFetching && (
                <ActivityIndicator color={theme.extends.colors.brand} />
              )}
              <AppText
                className="flex-1 text-small text-text-secondary"
                accessibilityLiveRegion="polite"
              >
                {statusMessage}
              </AppText>
            </View>
          )}

          {discovery.error && !limitError && (
            <View className="rounded-card bg-surface">
              <ErrorState
                size="section"
                title="Could not load businesses"
                description="The map is still available. Retry the searched area or search another area."
                primaryActionTitle="Retry"
                onPrimaryAction={() => {
                  void discovery.refetch();
                }}
              />
            </View>
          )}
        </View>

        {/* Full-width preview owns no camera or server state. */}
        {selectedBusiness && (
          <View
            onLayout={(event) => {
              setPreviewHeight(event.nativeEvent.layout.height);
            }}
          >
            <MSMEPreviewCard
              key={selectedBusiness.id}
              business={selectedBusiness}
              onClose={() => setSelectedBusinessId(null)}
              onViewBusiness={viewBusiness}
            />
          </View>
        )}
      </View>
    </View>
  );
}
