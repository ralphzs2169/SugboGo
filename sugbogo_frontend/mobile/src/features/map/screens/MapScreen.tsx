import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Linking,
  View,
} from "react-native";
import type RNMapView from "react-native-maps";
import {
  router,
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from "expo-router";
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
import ErrorState from "@/shared/components/ErrorState";
import useNavigationAction from "@/shared/hooks/useNavigationAction";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";
import useUserLocation from "@/shared/hooks/useUserLocation";

import BusinessDiscoveryMap, {
  type BusinessMapFocusTarget,
} from "../components/BusinessDiscoveryMap";
import MapControls from "../components/MapControls";
import MapSearchOverlay from "../components/MapSearchOverlay";
import MSMEPreviewCard from "../components/MSMEPreviewCard";
import MapBusinessSearchSheet from "../components/MapBusinessSearchSheet";
import useMapDirectory from "../hooks/useMapDirectory";
import useMapPreviewImpressions from "../hooks/useMapPreviewImpressions";
import {
  DEFAULT_MAP_FILTERS,
  type MapBounds,
  type MapDiscoveryFilters,
} from "../types/mapDiscovery.types";

/**
 * Discovers businesses from a complete cached directory with local map filters.
 * Camera movement is independent of business data loading.
 */
export default function MapScreen() {
  const isScreenFocused = useIsFocused();
  const navigation = useNavigation();
  const navigate = useNavigationAction();
  const locateIntentVersion = useRef(0);
  const locateInProgress = useRef(false);
  const userLocation = useUserLocation({
    mode: "recent",
    enabled: isScreenFocused,
  });
  const [filters, setFilters] =
    useState<MapDiscoveryFilters>(DEFAULT_MAP_FILTERS);
  const [draftFilters, setDraftFilters] = useState<ExploreResultsCriteria>({
    ...DEFAULT_MAP_FILTERS,
    search: "",
  });
  const taxonomy = useExploreFilterOptions();
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);
  const [showFilterError, setShowFilterError] = useState(false);
  const searchSheetRef = useRef<BottomSheetModal | null>(null);
  const filterSheetRef = useRef<BottomSheetModal | null>(null);
  const filterSheetOpen = useRef(false);
  const [searchSheetVisible, setSearchSheetVisible] = useState(false);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
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
  const [cameraTarget, setCameraTarget] = useState<
    (BusinessMapFocusTarget & { id: number }) | null
  >(null);
  const discovery = useMapDirectory(filters, searchTarget?.id);
  useEffect(() => {
    if (!cameraTarget) {
      destination.current = null;
    }
  }, [cameraTarget]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(
    null,
  );
  const [mapInstance, setMapInstance] = useState<RNMapView | null>(null);
  const [previewLayout, setPreviewLayout] = useState({
    id: null as number | null,
    height: 0,
  });
  const [headerBottom, setHeaderBottom] = useState(0);
  const previewHeight = previewLayout.height;

  const [selectionUnavailable, setSelectionUnavailable] = useState(false);
  const hasInteracted = useRef(false);
  const hasHandledInitialLocation = useRef(false);
  const bottomSpacing = useTabBarSpacing(16);

  useFocusEffect(
    useCallback(() => {
      const subscription = AppState.addEventListener(
        "change",
        (state) => {
          if (state === "background") {
            locateIntentVersion.current += 1;
            hasHandledInitialLocation.current = true;
          }
        },
      );

      // Blur and unmount revoke Map effects without cancelling shared GPS work.
      return () => {
        locateIntentVersion.current += 1;
        hasHandledInitialLocation.current = true;
        subscription.remove();
      };
    }, []),
  );

  const handleFocusStart = useCallback(() => {
    if (destination.current) {
      destination.current.started = true;
    }
  }, []);
  const filterCount =
    filters.categoryIds.length +
    Number(filters.clusterId !== null) +
    Number(filters.specialtyTagId !== null) +
    Number(filters.hiddenGems) +
    Number(filters.openNow);

  useQueryErrorNotification({
    error: discovery.selectionError,
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
    error: discovery.error,
    toastId: "map-discovery-error",
    title: "Could not load businesses",
    fallbackMessage: "Please retry loading the business directory.",
  });
  useQueryErrorNotification({
    error: discovery.openNowError,
    toastId: "map-open-now",
    title: "Could not check opening hours",
    fallbackMessage: "Retry checking which businesses are open.",
  });

  useEffect(() => {
    if (
      !mapInstance ||
      !isScreenFocused ||
      AppState.currentState === "background" ||
      userLocation.status === "loading" ||
      hasHandledInitialLocation.current
    ) {
      return;
    }

    hasHandledInitialLocation.current = true;

    if (userLocation.location && !hasInteracted.current) {
      mapInstance.animateToRegion({
        latitude: userLocation.location.coords.latitude,
        longitude: userLocation.location.coords.longitude,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      });
    }
  }, [
    isScreenFocused,
    mapInstance,
    userLocation.location,
    userLocation.status,
  ]);

  const handleViewportChange = useCallback((bounds: MapBounds) => {
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
        latitudeOffset > (bounds.north - bounds.south) * 0.5 ||
        longitudeOffset > (bounds.east - bounds.west) * 0.5
      ) {
        return;
      }
      destination.current = null;
      setCameraTarget(null);
    }
  }, []);

  const targetBusiness = discovery.selectedSearchBusiness;
  const displayedBusinesses = useMemo(() => {
    const pinned = targetBusiness;
    if (
      pinned &&
      !discovery.businesses.some((business) => business.id === pinned.id)
    ) {
      return [...discovery.businesses, pinned];
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
        cluster_icon: business.cluster?.icon ?? null,
      })),
    [displayedBusinesses],
  );

  const selectedBusiness = displayedBusinesses.find(
    (business) => business.id === selectedBusinessId,
  );
  const {
    viewportRef,
    previewRef,
    onViewportLayout,
    measurePreview,
    onIdentityGeometryChange,
  } = useMapPreviewImpressions(
    selectedBusiness?.id,
    bottomSpacing,
    headerBottom,
    headerBottom > 0 && !searchSheetVisible && !filterSheetVisible,
  );

  // Reset vanished IDs before rendering so a later response cannot reopen them.
  if (
    selectedBusinessId !== null &&
    !selectedBusiness &&
    !(searchTarget?.id === selectedBusinessId && !discovery.selectionResolved)
  ) {
    setSelectionUnavailable(searchTarget !== null);
    setSelectedBusinessId(null);
    setSearchTarget(null);
    setCameraTarget(null);
  }

  const clearSelection = () => {
    setSelectionUnavailable(false);
    setSelectedBusinessId(null);
    setSearchTarget(null);
    destination.current = null;
    setCameraTarget(null);
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
    setFilterSheetVisible(true);
    presentBottomSheet(filterSheetRef);
  };

  const selectSearchBusiness = (business: ExploreBusiness) => {
    if (!navigation.isFocused()) {
      return;
    }
    locateIntentVersion.current += 1;
    hasInteracted.current = true;
    setSelectionUnavailable(false);
    hasHandledInitialLocation.current = true;
    setCameraTarget({
      id: business.id,
      latitude: business.location.latitude,
      longitude: business.location.longitude,
    });
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
  };

  const viewBusiness = () => {
    if (!selectedBusiness || !navigation.isFocused()) {
      return;
    }

    navigate(() => {
      router.push({
        pathname: "/(explorer)/business/[businessId]",
        params: {
          businessId: String(selectedBusiness.id),
          profileSource: "MAP",
        },
      });
    });
  };

  const locateMe = async () => {
    hasInteracted.current = true;

    if (
      !navigation.isFocused() ||
      locateInProgress.current ||
      userLocation.isRefreshingLocation
    ) {
      return;
    }

    const intentVersion = ++locateIntentVersion.current;
    locateInProgress.current = true;

    try {
      const result = await userLocation.refreshLocation();

      if (
        intentVersion !== locateIntentVersion.current ||
        !navigation.isFocused() ||
        AppState.currentState === "background"
      ) {
        return;
      }

      if (result.status === "denied") {
        Alert.alert(
          "Location Permission Needed",
          "Allow location access in Settings, then try Locate me again. You can still explore the map manually.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: () => {
                if (
                  intentVersion !== locateIntentVersion.current ||
                  !navigation.isFocused()
                ) {
                  return;
                }
                void Linking.openSettings().catch(() => {
                  if (
                    intentVersion !== locateIntentVersion.current ||
                    !navigation.isFocused()
                  ) {
                    return;
                  }
                  Alert.alert(
                    "Could not open Settings",
                    "Open your device Settings to allow location access, then try Locate me again.",
                  );
                });
              },
            },
          ],
        );
        return;
      }

      if (result.status === "unavailable") {
        Alert.alert(
          "Location unavailable",
          "Check that device location services are on, then try again. You can still explore the map manually.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Try Again",
              onPress: () => {
                if (
                  intentVersion === locateIntentVersion.current &&
                  navigation.isFocused()
                ) {
                  void locateMe();
                }
              },
            },
          ],
        );
        return;
      }

      destination.current = null;
      setCameraTarget(null);
      mapInstance?.animateToRegion({
        latitude: result.location.coords.latitude,
        longitude: result.location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    } finally {
      locateInProgress.current = false;
    }
  };

  let statusMessage: string | null = null;
  if (selectionUnavailable) {
    statusMessage = "This business is no longer available. Try another search.";
  } else if (discovery.isLoading) {
    statusMessage = "Loading business directory…";
  } else if (discovery.isLoadingOpenNow) {
    statusMessage = "Checking opening hours…";
  } else if (
    !discovery.error &&
    !discovery.openNowError &&
    discovery.businesses.length === 0
  ) {
    statusMessage =
      filterCount > 0
        ? "No businesses match these map filters. Clear or adjust filters."
        : "No businesses are available yet.";
  }

  return (
    <View
      ref={viewportRef}
      collapsable={false}
      testID="map-impression-viewport"
      className="flex-1"
      onLayout={onViewportLayout}
    >
      {/* Live clustered map and existing overlays */}
      <BusinessDiscoveryMap
        isScreenFocused={isScreenFocused}
        businesses={markers}
        userLocation={userLocation.location}
        showsUserLocation={userLocation.status === "available"}
        autoCenterOnLocation={false}
        focusTarget={cameraTarget}
        onFocusStart={handleFocusStart}
        focusInsets={{
          top: headerBottom + 12,
          bottom: bottomSpacing + previewHeight + 12,
          ready: headerBottom > 0 && previewLayout.id === selectedBusinessId,
        }}
        onMapReady={setMapInstance}
        onViewportChange={handleViewportChange}
        onMapInteraction={() => {
          locateIntentVersion.current += 1;
          hasInteracted.current = true;
          destination.current = null;
          setCameraTarget(null);
        }}
        onBusinessPress={(id) => {
          const business = displayedBusinesses.find((item) => item.id === id);
          if (!business) return;
          locateIntentVersion.current += 1;
          hasInteracted.current = true;
          hasHandledInitialLocation.current = true;
          const target = {
            id,
            latitude: business.location.latitude,
            longitude: business.location.longitude,
            preserveZoom: true,
          };
          destination.current = { ...target, started: false };
          setCameraTarget(target);
          setSelectionUnavailable(false);
          setSelectedBusinessId(id);
          if (id !== searchTarget?.id) {
            setSearchTarget(null);
          }
        }}
        selectedBusinessId={selectedBusiness?.id ?? null}
        dimUnselectedMarkers
        useClusterIcons
        hideNativeZoomControls
        manageMarkerCamera
      />
      <MapSearchOverlay
        onHeaderLayout={setHeaderBottom}
        filters={filters}
        hideQuickFilters={selectedBusinessId !== null}
        filterCount={filterCount}
        onSearch={() => {
          setSearchSheetVisible(true);
          presentBottomSheet(searchSheetRef);
        }}
        onFilters={() => void openFilters()}
        onToggleQuick={(key) =>
          setFilters({ ...filters, [key]: !filters[key] })
        }
        onClear={() => setFilters(DEFAULT_MAP_FILTERS)}
      />
      <MapControls
        onLocateMe={() => void locateMe()}
        isLocating={userLocation.isRefreshingLocation}
        bottomOffset={
          selectedBusiness ? bottomSpacing + previewHeight + 12 : bottomSpacing
        }
      />

      {/* Nonblocking directory feedback */}
      <View
        className="absolute left-md right-md gap-sm"
        style={{ bottom: bottomSpacing }}
        pointerEvents="box-none"
        onLayout={measurePreview}
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
          {searchTarget && discovery.isLoadingSelection && !targetBusiness && (
            <View className="rounded-card bg-surface p-md">
              <AppText className="text-sm text-text-secondary">
                Loading selected business…
              </AppText>
            </View>
          )}
          {discovery.selectionError && (
            <View className="rounded-card bg-surface">
              <ErrorState
                size="section"
                title="Could not load selected business"
                description="The map is still available."
                primaryActionTitle="Retry"
                onPrimaryAction={() => void discovery.refetchSelection()}
              />
            </View>
          )}
          {statusMessage && !selectedBusiness && (
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

          {discovery.error && (
            <View className="rounded-card bg-surface">
              <ErrorState
                size="section"
                title="Could not load businesses"
                description="The complete directory could not be loaded. Any previous complete results remain available."
                primaryActionTitle="Retry"
                onPrimaryAction={() => {
                  void discovery.refetch();
                }}
              />
            </View>
          )}
          {discovery.openNowError && (
            <View className="rounded-card bg-surface">
              <ErrorState
                size="section"
                title="Could not check opening hours"
                description="Opening information could not be refreshed. Retry or turn off Open Now."
                primaryActionTitle="Retry"
                onPrimaryAction={() => void discovery.refetchOpenNow()}
              />
            </View>
          )}
        </View>

        {/* Full-width preview owns no camera or server state. */}
        {selectedBusiness && (
          <View
            key={selectedBusiness.id}
            ref={previewRef}
            collapsable={false}
            testID="business-preview-anchor"
            onLayout={(event) => {
              setPreviewLayout({
                id: selectedBusiness.id,
                height: event.nativeEvent.layout.height,
              });
              measurePreview();
            }}
          >
            <MSMEPreviewCard
              key={selectedBusiness.id}
              business={selectedBusiness}
              onClose={clearSelection}
              onViewBusiness={viewBusiness}
              onIdentityGeometryChange={onIdentityGeometryChange}
            />
          </View>
        )}
      </View>
      {/* Reuse Explore taxonomy controls; adapt Registration's search presentation. */}
      <MapBusinessSearchSheet
        sheetRef={searchSheetRef}
        onBusinessSelect={selectSearchBusiness}
        onVisibilityChange={setSearchSheetVisible}
        impressionsEnabled={!filterSheetVisible}
      />
      <SearchFilterBottomSheet
        sheetRef={filterSheetRef}
        options={taxonomy.options}
        draft={draftFilters}
        onChange={setDraftFilters}
        onDismiss={() => {
          filterSheetOpen.current = false;
          setFilterSheetVisible(false);
        }}
        onApply={() => {
          setFilters({
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
