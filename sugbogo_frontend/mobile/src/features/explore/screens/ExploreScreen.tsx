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

import DiscoverNearYouButton from "../components/DiscoverNearYouButton";
import ExploreBySpecialtySection from "../components/explore-by-specialty/ExploreBySpecialtySection";
import ExploreTopBar from "../components/ExploreTopBar";
import InterestsSection from "../components/interests/InterestsSection";
import NewBusinessesSection from "../components/new-businesses/NewBusinessesSection";
import WorthDiscoveringSection from "../components/worth-discovering/WorthDiscoveringSection";
import useBusinessImpressions from "../hooks/useBusinessImpressions";
import useDiscoveryFeed, {
  DISCOVERY_FEED_QUERY_KEY,
} from "../hooks/useDiscoveryFeed";
import useExploreLocation from "../hooks/useExploreLocation";
import { RECOMMENDATIONS_QUERY_KEY } from "../hooks/useRecommendations";
import ExplorePromptSection from "../components/explore-prompts/ExplorePromptSection";
import ExploreMapSection from "../components/explore-map/ExploreMapSection";

/**
 * Displays the Explorer discovery experience and coordinates its business feeds.
 *
 * The screen combines curated, personalized, specialty, and newly added
 * discovery surfaces while sharing refresh and impression observation.
 */
export default function ExploreScreen() {
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const bottomSpacing = useTabBarSpacing();

  const discoveryImpressions = useBusinessImpressions(bottomSpacing);
  const newBusinessImpressions = useBusinessImpressions(bottomSpacing);
  const recommendationImpressions = useBusinessImpressions(bottomSpacing);

  const userLocation = useExploreLocation();
  const discoveryFeed = useDiscoveryFeed();

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: DISCOVERY_FEED_QUERY_KEY,
        }),
        queryClient.refetchQueries({
          queryKey: ["explore-new-businesses"],
        }),
        queryClient.refetchQueries({
          queryKey: RECOMMENDATIONS_QUERY_KEY,
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

  return (
    <View className="flex-1 bg-surface">
      {/* Discovery controls */}
      <ExploreTopBar
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onPressFilters={() => {}}
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
        <WorthDiscoveringSection
          businesses={discoveryFeed.businesses}
          isLoading={discoveryFeed.isLoading}
          error={discoveryFeed.error}
          refetch={discoveryFeed.refetch}
          impressions={discoveryImpressions}
          userLocation={userLocation}
          onBusinessPress={handleBusinessPress}
        />

        {/* Specialty discovery preview */}
        <ExploreBySpecialtySection />

        {/* Personalized discovery */}
        <InterestsSection
          impressions={recommendationImpressions}
          userLocation={userLocation}
          onBusinessPress={handleBusinessPress}
        />

        {/* Recently added businesses */}
        <NewBusinessesSection
          impressions={newBusinessImpressions}
          userLocation={userLocation}
          onBusinessPress={handleBusinessPress}
        />

        {/* Intent-based discovery shortcuts */}
        <ExplorePromptSection />

        {/* Map discovery preview */}
        <ExploreMapSection
          userLocation={userLocation}
          onOpenMap={() => {
            router.push("/(explorer)/(tabs)/map");
          }}
        />
      </ScrollView>
    </View>
  );
}
