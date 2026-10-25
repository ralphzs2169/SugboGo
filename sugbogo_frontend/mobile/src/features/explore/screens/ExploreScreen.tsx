import { useQueryClient } from "@tanstack/react-query";
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
import { navigateToExploreResults } from "../utils/exploreResultsNavigation";
import type { ExploreCollectionType } from "../types/exploreBusiness.types";

/**
 * Displays the Explorer discovery experience and coordinates its business feeds.
 *
 * The screen combines curated, personalized, specialty, and newly added
 * discovery surfaces while sharing refresh and impression observation.
 */
export default function ExploreScreen() {
  const queryClient = useQueryClient();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshInProgress = useRef(false);
  const [openNowLocation, setOpenNowLocation] = useState<LocationObject | null>(
    null,
  );
  const [isUsingLastLocation, setIsUsingLastLocation] = useState(false);

  const bottomSpacing = useTabBarSpacing();

  const discoveryImpressions = useBusinessImpressions(bottomSpacing, 0);
  const spotlightImpressions = useBusinessImpressions(bottomSpacing, 0);
  const newBusinessImpressions = useBusinessImpressions(bottomSpacing, 0);
  const recommendationImpressions = useBusinessImpressions(bottomSpacing, 0);
  const openNowImpressions = useBusinessImpressions(bottomSpacing);

  const {
    location: userLocation,
    status: locationStatus,
    isRefreshingLocation,
    refreshLocation,
  } = useUserLocation();
  const nearbyLocation = openNowLocation;

  useEffect(() => {
    if (userLocation !== null && !refreshInProgress.current) {
      setOpenNowLocation((currentLocation) => currentLocation ?? userLocation);
    }
  }, [userLocation]);

  const openNow = useOpenNowBusinesses(
    nearbyLocation,
    !isRefreshing && !isRefreshingLocation,
  );

  const discoveryFeed = useDiscoveryFeed();
  const filterOptions = useExploreFilterOptions();

  const handleRefresh = async () => {
    if (refreshInProgress.current) {
      return;
    }

    refreshInProgress.current = true;
    setIsRefreshing(true);

    try {
      await queryClient.cancelQueries({
        queryKey: OPEN_NOW_BUSINESSES_QUERY_KEY,
      });

      // Resolve the device location before choosing this section's query key.
      const result = await refreshLocation();
      const nextLocation = result.location ?? openNowLocation;
      setOpenNowLocation(nextLocation);
      setIsUsingLastLocation(
        result.status !== "available" && nextLocation !== null,
      );

      await Promise.all([
        nextLocation !== null
          ? openNow.refreshAtLocation(nextLocation).catch(() => {
              // The section exposes this query's persistent error and Retry.
            })
          : Promise.resolve(),
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
    } finally {
      refreshInProgress.current = false;
      setIsRefreshing(false);
    }
  };

  const handleViewportLayout = (event: LayoutChangeEvent) => {
    discoveryImpressions.onViewportLayout(event);
    spotlightImpressions.onViewportLayout(event);
    newBusinessImpressions.onViewportLayout(event);
    recommendationImpressions.onViewportLayout(event);
    openNowImpressions.onViewportLayout(event);
  };

  const handleVerticalScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
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
    router.push({
      pathname: "/(explorer)/business/[businessId]",
      params: {
        businessId: String(businessId),
        profileSource: "EXPLORE_DISCOVERY",
        distance: distance !== null ? String(distance) : "",
        distanceAccuracy:
          distanceAccuracy !== null ? String(distanceAccuracy) : "",
      },
    });
  };

  const openCollection = (
    collectionType: ExploreCollectionType,
    source?: "recommendations",
  ) => {
    router.push({
      pathname: "/(explorer)/explore-collection/[collectionType]",
      params: {
        collectionType,
        ...(source ? { source } : {}),
      },
    });
  };

  return (
    <View className="flex-1 bg-surface">
      {/* Discovery controls */}
      <ExploreTopBar
        clusters={filterOptions.options.clusters}
        selectedClusterId={null}
        isLoadingClusters={filterOptions.isLoading}
        onSelectCluster={(clusterId) => {
          if (clusterId !== null) {
            navigateToExploreResults({ clusterId });
          }
        }}
        onPressSearch={() => navigateToExploreResults({}, false, true)}
        onPressFilters={() => navigateToExploreResults({}, true)}
      />

      {/* Discovery content */}
      <ScrollView
        testID="explore-discovery-scroll"
        onLayout={handleViewportLayout}
        onScroll={handleVerticalScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerClassName=" pb-8"
        contentContainerStyle={{
          paddingBottom: bottomSpacing,
        }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Curated discovery */}
        <HiddenGemsSection
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
        <OpenNowBusinessesSection
          feed={openNow}
          userLocation={nearbyLocation}
          isLocating={locationStatus === "loading" && openNowLocation === null}
          isUsingLastLocation={isUsingLastLocation}
          impressions={openNowImpressions}
          onBusinessPress={handleBusinessPress}
        />

        {/* Specialty discovery preview */}
        <ExploreBySpecialtySection
          onSpecialtyPress={(specialtyTagId) =>
            navigateToExploreResults({ specialtyTagId })
          }
        />

        {/* Personalized discovery */}
        <UserInterestsSection
          impressions={recommendationImpressions}
          userLocation={userLocation}
          onBusinessPress={handleBusinessPress}
          onSeeAll={(source) => openCollection("interests", source)}
        />

        {/* Recently added businesses */}
        <NewBusinessesSection
          impressions={newBusinessImpressions}
          userLocation={userLocation}
          onBusinessPress={handleBusinessPress}
          onSeeAll={() => openCollection("new-businesses")}
        />

        {/* Intent-based discovery shortcuts */}
        <DiscoveryShortcutsSection
          onShortcutPress={(clusterId) =>
            navigateToExploreResults({ clusterId })
          }
        />
      </ScrollView>
    </View>
  );
}
