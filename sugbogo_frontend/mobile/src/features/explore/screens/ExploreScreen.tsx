import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
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
import useBusinessImpressions from "../hooks/useBusinessImpressions";
import useMapPreviewBusinesses, {
  MAP_PREVIEW_QUERY_KEY,
} from "../hooks/useMapPreviewBusinesses";
import useDiscoveryFeed, {
  DISCOVERY_FEED_QUERY_KEY,
} from "../hooks/useDiscoveryFeed";

import { RECOMMENDATIONS_QUERY_KEY } from "../hooks/useRecommendations";
import DiscoveryShortcutsSection from "../components/discovery-shortcuts/DiscoveryShortcutsSection";
import ExploreMapSection from "../components/explore-map/ExploreMapSection";
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

  const bottomSpacing = useTabBarSpacing();

  const discoveryImpressions = useBusinessImpressions(bottomSpacing);
  const newBusinessImpressions = useBusinessImpressions(bottomSpacing);
  const recommendationImpressions = useBusinessImpressions(bottomSpacing);

  const { location: userLocation, refreshLocation } = useUserLocation();

  const mapPreview = useMapPreviewBusinesses(
    userLocation?.coords.latitude ?? null,
    userLocation?.coords.longitude ?? null,
  );

  const discoveryFeed = useDiscoveryFeed();
  const filterOptions = useExploreFilterOptions();

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      await Promise.all([
        refreshLocation(),
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
        queryClient.refetchQueries({
          queryKey: MAP_PREVIEW_QUERY_KEY,
        }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleViewportLayout = (event: LayoutChangeEvent) => {
    discoveryImpressions.onViewportLayout(event);
    newBusinessImpressions.onViewportLayout(event);
    recommendationImpressions.onViewportLayout(event);
  };

  const handleVerticalScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    discoveryImpressions.onVerticalScroll(event);
    newBusinessImpressions.onVerticalScroll(event);
    recommendationImpressions.onVerticalScroll(event);
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
        onPressSearch={() => navigateToExploreResults({}, false, true)}
        onSelectCluster={(clusterId) => {
          if (clusterId !== null) {
            navigateToExploreResults({ clusterId });
          }
        }}
        onPressFilters={() => navigateToExploreResults({}, true)}
        isLoadingClusters={filterOptions.isLoading}
      />

      {/* Discovery content */}
      <ScrollView
        testID="explore-discovery-scroll"
        onLayout={handleViewportLayout}
        onScroll={handleVerticalScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pt-4 pb-8"
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
          error={discoveryFeed.error}
          refetch={discoveryFeed.refetch}
          impressions={discoveryImpressions}
          userLocation={userLocation}
          onBusinessPress={handleBusinessPress}
          onSeeAll={() => openCollection("hidden-gems")}
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

        {/* Map discovery preview */}
        <ExploreMapSection
          businesses={mapPreview.businesses}
          isLoading={mapPreview.isLoading}
          error={mapPreview.error}
          refetch={mapPreview.refetch}
          userLocation={userLocation}
          onOpenMap={() => {
            router.push("/(explorer)/(tabs)/map");
          }}
        />
      </ScrollView>
    </View>
  );
}
