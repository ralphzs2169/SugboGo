import { hashKey, useIsRestoring, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import type { LocationObject } from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from "react-native";

import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";
import useNavigationAction from "@/shared/hooks/useNavigationAction";
import { useExplorerTour } from "@/features/guided-tour/hooks/useExplorerTour";
import {
  BookmarkTourSurfaceContext,
  useBookmarkTourSurface,
} from "@/features/guided-tour/hooks/useBookmarkTourSurface";

import ExploreBySpecialtySection from "../components/explore-by-specialty/ExploreBySpecialtySection";
import ExploreTopBar from "../components/ExploreTopBar";
import UserInterestsSection from "../components/interests/UserInterestsSection";
import NewBusinessesSection from "../components/new-businesses/NewBusinessesSection";
import HiddenGemsSection from "../components/hidden-gems/HiddenGemsSection";
import OpenNowBusinessesSection from "../components/open-now/OpenNowBusinessesSection";
import useOpenNowBusinesses from "../hooks/useOpenNowBusinesses";
import { OPEN_NOW_BUSINESSES_QUERY_KEY } from "../constants/exploreHomepageQueries";
import useBusinessImpressions from "../hooks/useBusinessImpressions";
import useDiscoveryFeed, {
  DISCOVERY_FEED_QUERY_KEY,
} from "../hooks/useDiscoveryFeed";

import { RECOMMENDATIONS_QUERY_KEY } from "../hooks/useRecommendations";
import DiscoveryShortcutsSection from "../components/discovery-shortcuts/DiscoveryShortcutsSection";
import { EXPLORE_SPECIALTIES_QUERY_KEY } from "../hooks/useExploreSpecialties";
import { DISCOVERY_SHORTCUTS_QUERY_KEY } from "../hooks/useDiscoveryShortcuts";
import useUserLocation from "@/shared/hooks/useUserLocation";
import useExploreFilterOptions from "../hooks/useExploreFilterOptions";
import { EXPLORE_FILTER_OPTIONS_QUERY_KEY } from "../constants/exploreHomepageQueries";
import ExploreFilterOptionsFeedback from "../components/ExploreFilterOptionsFeedback";
import { navigateToExploreResults } from "../utils/exploreResultsNavigation";
import type { ExploreCollectionType } from "../types/exploreBusiness.types";

/**
 * Displays the Explorer discovery experience and coordinates its business feeds.
 *
 * The screen combines curated, personalized, specialty, and newly added
 * discovery surfaces while sharing refresh and impression observation.
 */
export default function ExploreScreen({
  offline = false,
  hasDownloads = false,
}: {
  offline?: boolean;
  hasDownloads?: boolean;
} = {}) {
  const queryClient = useQueryClient();
  const isRestoring = useIsRestoring();
  const navigate = useNavigationAction();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const bookmarkTour = useBookmarkTourSurface("/explore", isRefreshing);
  const [isRefreshingNearby, setIsRefreshingNearby] = useState(false);
  const refreshInProgress = useRef(false);
  const [openNowLocation, setOpenNowLocation] = useState<LocationObject | null>(
    null,
  );
  const [isUsingLastLocation, setIsUsingLastLocation] = useState(false);
  const appliedUserLocation = useRef<LocationObject | null>(null);

  const bottomSpacing = useTabBarSpacing();

  const discoveryImpressions = useBusinessImpressions(bottomSpacing, 0, !offline);
  const spotlightImpressions = useBusinessImpressions(bottomSpacing, 0, !offline);
  const newBusinessImpressions = useBusinessImpressions(bottomSpacing, 0, !offline);
  const recommendationImpressions = useBusinessImpressions(
    bottomSpacing,
    0,
    !offline,
  );
  const openNowImpressions = useBusinessImpressions(bottomSpacing, 0, !offline);

  const {
    location: userLocation,
    status: locationStatus,
    error: locationError,
    isRefreshingLocation,
    refreshLocation,
  } = useUserLocation({ mode: "recent", enabled: !offline });
  const setTourLocationReady = useExplorerTour()?.setExploreLocationReady;

  useEffect(() => {
    setTourLocationReady?.(!isRefreshingLocation);
  }, [isRefreshingLocation, setTourLocationReady]);

  useEffect(() => {
    return () => setTourLocationReady?.(false);
  }, [setTourLocationReady]);

  const nearbyLocation = openNowLocation;

  useEffect(() => {
    if (refreshInProgress.current) return;
    if (locationStatus === "denied") {
      setOpenNowLocation(null);
      setIsUsingLastLocation(false);
    } else if (
      userLocation !== null &&
      userLocation !== appliedUserLocation.current
    ) {
      appliedUserLocation.current = userLocation;
      setOpenNowLocation(userLocation);
      setIsUsingLastLocation(false);
    } else if (locationStatus !== "loading") {
      // A cached reading can expire while Explore is open without a failed request.
      setIsUsingLastLocation(
        locationStatus === "unavailable" &&
          locationError != null &&
          openNowLocation !== null,
      );
    }
  }, [locationError, locationStatus, openNowLocation, userLocation]);

  const openNow = useOpenNowBusinesses(
    nearbyLocation,
    !offline && !isRefreshingNearby && !isRefreshingLocation,
  );

  const discoveryFeed = useDiscoveryFeed(!offline);
  const filterOptions = useExploreFilterOptions(!offline);

  const handleRefresh = async () => {
    if (offline || refreshInProgress.current) {
      return;
    }

    refreshInProgress.current = true;
    setIsRefreshing(true);
    setIsRefreshingNearby(true);

    try {
      // These sections do not depend on GPS or the Open Now query key.
      const independentRefreshes = Promise.allSettled([
        queryClient.refetchQueries({
          queryKey: EXPLORE_FILTER_OPTIONS_QUERY_KEY,
        }),
        queryClient.refetchQueries({
          queryKey: DISCOVERY_FEED_QUERY_KEY,
        }),
        queryClient.refetchQueries({
          queryKey: ["explore-new-businesses"],
        }),
        queryClient.refetchQueries({
          queryKey: RECOMMENDATIONS_QUERY_KEY,
        }),
        queryClient.refetchQueries({
          queryKey: EXPLORE_SPECIALTIES_QUERY_KEY,
        }),
        queryClient.refetchQueries({
          queryKey: DISCOVERY_SHORTCUTS_QUERY_KEY,
        }),
      ]);

      const refreshNearby = async () => {
        try {
          await queryClient.cancelQueries({
            queryKey: OPEN_NOW_BUSINESSES_QUERY_KEY,
          });
          // Only Open Now waits for the coordinates used by its query key.
          const result = await refreshLocation();
          const nextLocation =
            result.status === "denied"
              ? null
              : (result.location ?? openNowLocation);
          setOpenNowLocation(nextLocation);
          setIsUsingLastLocation(
            result.status === "unavailable" &&
              result.error != null &&
              nextLocation !== null,
          );

          if (nextLocation !== null) {
            await openNow.refreshAtLocation(nextLocation);
          }
        } finally {
          setIsRefreshingNearby(false);
        }
      };

      // Each query retains its own error/Retry state; the spinner covers both branches.
      await Promise.allSettled([independentRefreshes, refreshNearby()]);
    } finally {
      refreshInProgress.current = false;
      setIsRefreshing(false);
    }
  };

  const handleViewportLayout = (event: LayoutChangeEvent) => {
    bookmarkTour.onLayout?.();
    discoveryImpressions.onViewportLayout(event);
    spotlightImpressions.onViewportLayout(event);
    newBusinessImpressions.onViewportLayout(event);
    recommendationImpressions.onViewportLayout(event);
    openNowImpressions.onViewportLayout(event);
  };

  const handleVerticalScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    bookmarkTour.onScroll();
    discoveryImpressions.onVerticalScroll(event);
    spotlightImpressions.onVerticalScroll(event);
    newBusinessImpressions.onVerticalScroll(event);
    recommendationImpressions.onVerticalScroll(event);
    openNowImpressions.onVerticalScroll(event);
  };

  const handleBusinessPress = (
    businessId: number,
    distance: number | null,
    distanceAccuracy: number | null,
  ) => {
    if (offline) {
      navigate(() =>
        router.push({
          pathname: "/recent-explore/[businessId]",
          params: { businessId: String(businessId) },
        }),
      );
      return;
    }

    navigate(() =>
      router.push({
        pathname: "/(explorer)/business/[businessId]",
        params: {
          businessId: String(businessId),
          profileSource: "EXPLORE_DISCOVERY",
          ...(nearbyLocation
            ? {
                previewQueryHash: hashKey([
                  ...OPEN_NOW_BUSINESSES_QUERY_KEY,
                  nearbyLocation.coords.latitude,
                  nearbyLocation.coords.longitude,
                ]),
              }
            : {}),
          distance: distance !== null ? String(distance) : "",
          distanceAccuracy:
            distanceAccuracy !== null ? String(distanceAccuracy) : "",
        },
      }),
    );
  };

  const openCollection = (
    collectionType: ExploreCollectionType,
    source?: "recommendations",
  ) => {
    navigate(() =>
      router.push({
        pathname: "/(explorer)/explore-collection/[collectionType]",
        params: {
          collectionType,
          ...(source ? { source } : {}),
        },
      }),
    );
  };

  return (
    <View className="flex-1 bg-surface">
      {/* Discovery controls */}
      <ExploreTopBar
        offline={offline}
        onOpenOfflineStorage={
          offline && hasDownloads
            ? () => navigate(() => router.push("/offline-storage"))
            : undefined
        }
        clusters={filterOptions.options.clusters}
        selectedClusterId={null}
        isLoadingClusters={filterOptions.isLoading}
        onSelectCluster={(clusterId) => {
          if (clusterId !== null) {
            navigate(() => navigateToExploreResults({ clusterId }));
          }
        }}
        onPressSearch={() =>
          navigate(() => navigateToExploreResults({}, false, true))
        }
        onPressFilters={() =>
          navigate(() => navigateToExploreResults({}, true))
        }
      />
      {!offline && (
        <ExploreFilterOptionsFeedback state={filterOptions} showLoading={false} />
      )}

      {/* Discovery content */}
      <BookmarkTourSurfaceContext.Provider value={bookmarkTour.surface}>
        <ScrollView
          ref={bookmarkTour.attachViewport}
          testID="explore-discovery-scroll"
          onLayout={handleViewportLayout}
          onScroll={handleVerticalScroll}
          onTouchStart={bookmarkTour.onTouchStart}
          onTouchEnd={bookmarkTour.onTouchEnd}
          onTouchCancel={bookmarkTour.onTouchCancel}
          onContentSizeChange={bookmarkTour.onContentSizeChange}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerClassName=" pb-8"
          contentContainerStyle={{
            paddingBottom: bottomSpacing,
          }}
          refreshControl={
            !offline ? (
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
            ) : undefined
          }
        >
          {/* Curated discovery */}
          <HiddenGemsSection
            offline={offline}
            businesses={discoveryFeed.businesses}
            isLoading={discoveryFeed.isLoading}
            isPaused={discoveryFeed.isPaused}
            error={discoveryFeed.error}
            refetch={discoveryFeed.refetch}
            impressions={discoveryImpressions}
            spotlightImpressions={spotlightImpressions}
            userLocation={userLocation}
            onBusinessPress={handleBusinessPress}
          />

          {/* Nearby businesses open according to their listed hours */}
          {!offline && (
            <OpenNowBusinessesSection
              feed={openNow}
              userLocation={nearbyLocation}
              isLocating={
                openNowLocation === null &&
                (
                  isRestoring ||
                  locationStatus === "loading" ||
                  userLocation !== null
                )
              }
              isUsingLastLocation={isUsingLastLocation}
              impressions={openNowImpressions}
              onBusinessPress={handleBusinessPress}
            />
          )}

          {/* Specialty discovery preview */}
          <ExploreBySpecialtySection
            offline={offline}
            onSpecialtyPress={
              offline ? undefined : (specialtyTagId) =>
                navigate(() => navigateToExploreResults({ specialtyTagId }))
            }
          />

          {/* Personalized discovery */}
          <UserInterestsSection
            offline={offline}
            impressions={recommendationImpressions}
            userLocation={userLocation}
            onBusinessPress={handleBusinessPress}
            onSeeAll={
              offline ? undefined : (source) => openCollection("interests", source)
            }
          />

          {/* Recently added businesses */}
          <NewBusinessesSection
            offline={offline}
            impressions={newBusinessImpressions}
            userLocation={userLocation}
            onBusinessPress={handleBusinessPress}
            onSeeAll={offline ? undefined : () => openCollection("new-businesses")}
          />

          {/* Intent-based discovery shortcuts */}
          <DiscoveryShortcutsSection
            offline={offline}
            onShortcutPress={
              offline ? undefined : (clusterId) =>
                navigate(() => navigateToExploreResults({ clusterId }))
            }
          />
        </ScrollView>
      </BookmarkTourSurfaceContext.Provider>
    </View>
  );
}
