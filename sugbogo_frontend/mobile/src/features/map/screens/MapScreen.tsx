import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, View } from "react-native";
import type RNMapView from "react-native-maps";
import { router, useNavigation } from "expo-router";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import SearchFilterBottomSheet from "@/features/explore/components/search-filter-results/SearchFilterBottomSheet";
import useExploreFilterOptions from "@/features/explore/hooks/useExploreFilterOptions";
import type {
  ExploreBusiness,
  ExploreResultsCriteria,
} from "@/features/explore/types/exploreBusiness.types";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

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
import MapBusinessSearchSheet from "../components/MapBusinessSearchSheet";
import useMapDiscovery from "../hooks/useMapDiscovery";
import useMapViewport from "../hooks/useMapViewport";
import {
  DEFAULT_MAP_FILTERS,
  type MapBounds,
  type MapDiscoveryFilters,
} from "../types/mapDiscovery.types";
import { isViewportLimitError } from "../utils/mapViewport";

/**
 * Discovers live businesses in explicitly searched map viewports.
 * Camera movement stays local until Search this area is pressed.
 */
export default function MapScreen() {
  const navigation = useNavigation();
  const userLocation = useUserLocation();
  const viewport = useMapViewport();
  const [filters, setFilters] =
    useState<MapDiscoveryFilters>(DEFAULT_MAP_FILTERS);
  const [draftFilters, setDraftFilters] = useState<ExploreResultsCriteria>({
    ...DEFAULT_MAP_FILTERS,
    search: "",
  });
  const taxonomy = useExploreFilterOptions();
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);
  const [showFilterError, setShowFilterError] = useState(false);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const applyingFilters = useRef(false);
  const searchSheetRef = useRef<BottomSheetModal | null>(null);
  const filterSheetRef = useRef<BottomSheetModal | null>(null);
  const filterSheetOpen = useRef(false);
  const discovery = useMapDiscovery(viewport.committedBounds, filters);
  const [searchTarget, setSearchTarget] = useState<{
    id: number;
    latitude: number;
    longitude: number;
  } | null>(null);
  const destination = useRef<{
    latitude: number;
    longitude: number;
    started: boolean;
  } | null>(null);
  const targetBounds = useMemo(
    () =>
      searchTarget
        ? {
            north: searchTarget.latitude + 0.001,
            south: searchTarget.latitude - 0.001,
            east: searchTarget.longitude + 0.001,
            west: searchTarget.longitude - 0.001,
          }
        : null,
    [searchTarget],
  );
  const targetQuery = useMapDiscovery(targetBounds, {
    ...DEFAULT_MAP_FILTERS,
    businessId: searchTarget?.id,
  });
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
  useEffect(() => {
    if (mapInstance && destination.current && !destination.current.started) {
      mapInstance.animateToRegion({
        latitude: destination.current.latitude,
        longitude: destination.current.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  }, [mapInstance]);
  const filterCount =
    filters.categoryIds.length +
    Number(filters.clusterId !== null) +
    Number(filters.specialtyTagId !== null) +
    Number(filters.hiddenGems) +
    Number(filters.openNow);

  useQueryErrorNotification({
    error: targetQuery.error,
    toastId: "map-search-selection",
    title: "Could not load selected business",
    fallbackMessage: "Retry loading this search selection.",
  });
  useQueryErrorNotification({
    error: showFilterError ? taxonomy.error : null,
    toastId: "map-filter-options",
    title: "Could not load filters",
    fallbackMessage: "Please try again.",
  });

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!filterSheetOpen.current) {
          return false;
        }
        filterSheetRef.current?.dismiss();
        return true;
      },
    );
    return () => subscription.remove();
  }, []);

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
      if (destination.current) {
        const target = destination.current;
        const latitudeOffset = Math.abs(
          (bounds.north + bounds.south) / 2 - target.latitude,
        );
        const longitudeOffset = Math.abs(
          (bounds.east + bounds.west) / 2 - target.longitude,
        );
        if (
          !target.started ||
          latitudeOffset > (bounds.north - bounds.south) * 0.2 ||
          longitudeOffset > (bounds.east - bounds.west) * 0.2
        ) {
          return;
        }
        destination.current = null;
        onViewportChange(bounds, true);
        return;
      }
      // Ignore a ready-time read that finishes before native centering starts.
      if (searchAfterInitialCenter.current && !initialCenterStarted.current) {
        return;
      }

      onViewportChange(bounds, searchAfterInitialCenter.current);
      searchAfterInitialCenter.current = false;
    },
    [onViewportChange],
  );

  const targetBusiness = targetQuery.businesses.find(
    (business) => business.id === selectedBusinessId,
  );
  const displayedBusinesses = useMemo(() => {
    if (
      targetBusiness &&
      !discovery.businesses.some(
        (business) => business.id === targetBusiness.id,
      )
    ) {
      return [...discovery.businesses, targetBusiness];
    }
    return discovery.businesses;
  }, [discovery.businesses, targetBusiness]);

  const markers = useMemo(
    () =>
      displayedBusinesses.map((business) => ({
        id: business.id,
        latitude: business.location.latitude,
        longitude: business.location.longitude,
        is_hidden_gem: business.is_hidden_gem === true,
      })),
    [displayedBusinesses],
  );

  const selectedBusiness = displayedBusinesses.find(
    (business) => business.id === selectedBusinessId,
  );

  // Reset vanished IDs before rendering so a later response cannot reopen them.
  if (
    selectedBusinessId !== null &&
    !selectedBusiness &&
    !(searchTarget?.id === selectedBusinessId && !targetQuery.pagination)
  ) {
    setSelectedBusinessId(null);
    setSearchTarget(null);
  }

  const clearSelection = () => {
    setSelectedBusinessId(null);
    setSearchTarget(null);
    destination.current = null;
  };

  const applyMapFilters = async (next: MapDiscoveryFilters) => {
    if (applyingFilters.current) {
      return;
    }
    applyingFilters.current = true;
    setIsApplyingFilters(true);
    let bounds = viewport.viewedBounds;
    try {
      const visible = await mapInstance?.getMapBoundaries();
      if (visible) {
        bounds = {
          north: visible.northEast.latitude,
          south: visible.southWest.latitude,
          east: visible.northEast.longitude,
          west: visible.southWest.longitude,
        };
      }
    } catch {
      // Providers without boundaries retain the last completed visible region.
    }
    setFilters(next);
    if (bounds) {
      onViewportChange(bounds, true);
    }
    applyingFilters.current = false;
    setIsApplyingFilters(false);
  };

  const openFilters = async () => {
    setDraftFilters({
      search: "",
      clusterId: filters.clusterId,
      categoryIds: [...filters.categoryIds],
      specialtyTagId: filters.specialtyTagId,
    });
    if (taxonomy.isLoading || taxonomy.error) {
      setIsLoadingFilters(true);
      const result = await taxonomy.refetch();
      setIsLoadingFilters(false);
      if (result.error) {
        setShowFilterError(true);
        return;
      }
    }
    setShowFilterError(false);
    if (!navigation.isFocused()) {
      return;
    }
    filterSheetOpen.current = true;
    presentBottomSheet(filterSheetRef);
  };

  const selectSearchBusiness = (business: ExploreBusiness) => {
    if (!navigation.isFocused()) {
      return;
    }
    hasInteracted.current = true;
    hasHandledInitialLocation.current = true;
    searchAfterInitialCenter.current = false;
    setSelectedBusinessId(business.id);
    setSearchTarget({
      id: business.id,
      latitude: business.location.latitude,
      longitude: business.location.longitude,
    });
    destination.current = {
      latitude: business.location.latitude,
      longitude: business.location.longitude,
      started: false,
    };
    mapInstance?.animateToRegion({
      latitude: business.location.latitude,
      longitude: business.location.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  };

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
      filterCount > 0
        ? "No businesses match these map filters. Clear or adjust filters, or search another area."
        : "No businesses in the searched area. Move the map and search another area.";
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
          if (destination.current) {
            destination.current.started = true;
          }
          if (searchAfterInitialCenter.current) {
            initialCenterStarted.current = true;
          }

          viewport.onViewportChanging();
        }}
        onMapInteraction={() => {
          hasInteracted.current = true;
          searchAfterInitialCenter.current = false;
          destination.current = null;
        }}
        onBusinessPress={(id) => {
          setSelectedBusinessId(id);
          if (id !== searchTarget?.id) {
            setSearchTarget(null);
          }
        }}
        selectedBusinessId={selectedBusiness?.id ?? null}
      />
      <MapSearchOverlay
        filters={filters}
        filterCount={filterCount}
        onSearch={() => presentBottomSheet(searchSheetRef)}
        onFilters={() => void openFilters()}
        onToggleQuick={(key) =>
          void applyMapFilters({ ...filters, [key]: !filters[key] })
        }
        onClear={() => void applyMapFilters(DEFAULT_MAP_FILTERS)}
        disabled={viewport.isMoving || isApplyingFilters}
      />
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
          {isLoadingFilters && (
            <View className="rounded-card bg-surface p-md">
              <AppText className="text-sm text-text-secondary">
                Loading map filters…
              </AppText>
            </View>
          )}
          {showFilterError && (
            <View className="rounded-card bg-surface">
              <ErrorState
                size="section"
                title="Could not load filters"
                description="Try loading the filter options again."
                primaryActionTitle="Retry"
                onPrimaryAction={() => void openFilters()}
              />
            </View>
          )}
          {searchTarget && targetQuery.isFetching && !targetBusiness && (
            <View className="rounded-card bg-surface p-md">
              <AppText className="text-sm text-text-secondary">
                Loading selected business…
              </AppText>
            </View>
          )}
          {targetQuery.error && (
            <View className="rounded-card bg-surface">
              <ErrorState
                size="section"
                title="Could not load selected business"
                description="The map is still available."
                primaryActionTitle="Retry"
                onPrimaryAction={() => void targetQuery.refetch()}
              />
            </View>
          )}
          {targetBusiness &&
            !discovery.businesses.some(
              (business) => business.id === targetBusiness.id,
            ) && (
              <View className="rounded-card bg-surface p-md">
                <AppText className="text-small text-text-secondary">
                  {filterCount
                    ? "Your search selection is shown separately from the active map filters."
                    : "Your search selection is shown alongside this area's results."}
                </AppText>
              </View>
            )}
          {viewport.canSearch && (
            <Button
              title="Search this area"
              rounded="full"
              className="self-center"
              onPress={() => {
                clearSelection();
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
              onClose={clearSelection}
              onViewBusiness={viewBusiness}
            />
          </View>
        )}
      </View>
      {/* Reuse Explore taxonomy controls; adapt Registration's search presentation. */}
      <MapBusinessSearchSheet
        sheetRef={searchSheetRef}
        onBusinessSelect={selectSearchBusiness}
      />
      <SearchFilterBottomSheet
        sheetRef={filterSheetRef}
        options={taxonomy.options}
        draft={draftFilters}
        onChange={setDraftFilters}
        onDismiss={() => {
          filterSheetOpen.current = false;
        }}
        onApply={() => {
          applyMapFilters({
            ...filters,
            clusterId: draftFilters.clusterId,
            categoryIds: draftFilters.categoryIds,
            specialtyTagId: draftFilters.specialtyTagId,
          });
          filterSheetRef.current?.dismiss();
        }}
      />
    </View>
  );
}
