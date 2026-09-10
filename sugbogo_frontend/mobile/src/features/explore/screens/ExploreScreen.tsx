import { router } from "expo-router";
import {
  RefreshControl,
  ScrollView,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from "react-native";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import ExploreTopBar from "../components/ExploreTopBar";
import HiddenGemsSection from "../components/hidden-gems/HiddenGemsSection";
import InterestsSection from "../components/interests/InterestsSection";
import TrendingSection from "../components/trending/TrendingSection";
import NewBusinessesSection from "../components/new-businesses/NewBusinessesSection";
import WorthDiscoveringSection from "../components/worth-discovering/WorthDiscoveringSection";
import DiscoverNearYouButton from "../components/DiscoverNearYouButton";
import useBusinessImpressions from "../hooks/useBusinessImpressions";
import useDiscoveryFeed, {
  DISCOVERY_FEED_QUERY_KEY,
} from "../hooks/useDiscoveryFeed";
import useExploreLocation from "../hooks/useExploreLocation";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";
import useApiErrorNotification from "@/shared/hooks/useApiErrorNotification";

/** Displays discovery sections and observes real business cards within both scroll axes. */
export default function ExploreScreen() {
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const bottomSpacing = useTabBarSpacing();
  const discoveryImpressions = useBusinessImpressions(bottomSpacing);
  const newBusinessImpressions = useBusinessImpressions(bottomSpacing);
  const userLocation = useExploreLocation();
  const discoveryFeed = useDiscoveryFeed();

  useApiErrorNotification({
    error: discoveryFeed.error,
    toastId: "explore-discovery-feed-error",
    title: "Unable to load Worth Discovering",
    fallbackMessage: "Please try again.",
  });

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
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleViewportLayout = (event: LayoutChangeEvent) => {
    discoveryImpressions.onViewportLayout(event);
    newBusinessImpressions.onViewportLayout(event);
  };

  const handleVerticalScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    discoveryImpressions.onVerticalScroll(event);
    newBusinessImpressions.onVerticalScroll(event);
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
      <ExploreTopBar
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onPressFilters={() => {}}
      />

      {/* Discovery viewport excludes the fixed navigation controls. */}
      <ScrollView
        testID="explore-discovery-scroll"
        onLayout={handleViewportLayout}
        onScroll={handleVerticalScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pt-4 pb-8"
        contentContainerStyle={{ paddingBottom: bottomSpacing }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <WorthDiscoveringSection
          businesses={discoveryFeed.businesses}
          isLoading={discoveryFeed.isLoading}
          error={discoveryFeed.error}
          refetch={discoveryFeed.refetch}
          impressions={discoveryImpressions}
          userLocation={userLocation}
          onBusinessPress={handleBusinessPress}
        />

        <HiddenGemsSection selectedCategory={selectedCategory} />

        <InterestsSection selectedCategory={selectedCategory} />

        <TrendingSection selectedCategory={selectedCategory} />

        <NewBusinessesSection
          impressions={newBusinessImpressions}
          userLocation={userLocation}
          onBusinessPress={handleBusinessPress}
        />

        <DiscoverNearYouButton onPress={() => {}} />
      </ScrollView>
    </View>
  );
}
