import { router } from "expo-router";
import { RefreshControl, ScrollView, View } from "react-native";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import ExploreTopBar from "../components/ExploreTopBar";
import HiddenGemsSection from "../components/hidden-gems/HiddenGemsSection";
import InterestsSection from "../components/interests/InterestsSection";
import DiscoverMoreSection from "../components/discover-more/DiscoverMoreSection";
import TrendingSection from "../components/trending/TrendingSection";
import NewBusinessesSection from "../components/new-businesses/NewBusinessesSection";
import DiscoverNearYouButton from "../components/DiscoverNearYouButton";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";

export default function ExploreScreen() {
  const queryClient = useQueryClient();

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const bottomSpacing = useTabBarSpacing();

  const handleBusinessPress = (businessId: number) => {
    router.push({
      pathname: "/business/[businessId]",
      params: {
        businessId: businessId.toString(),
      },
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      await queryClient.refetchQueries({
        queryKey: ["explore-new-businesses"],
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ExploreTopBar
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pt-4 pb-8"
        contentContainerStyle={{ paddingBottom: bottomSpacing }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <HiddenGemsSection selectedCategory={selectedCategory} />

        <InterestsSection selectedCategory={selectedCategory} />

        <DiscoverMoreSection selectedCategory={selectedCategory} />

        <TrendingSection selectedCategory={selectedCategory} />

        <NewBusinessesSection
          onBusinessPress={(businessId, distance, distanceAccuracy) => {
            router.push({
              pathname: "/(explorer)/business/[businessId]",
              params: {
                businessId: String(businessId),
                distance: distance !== null ? String(distance) : "",
                distanceAccuracy:
                  distanceAccuracy !== null ? String(distanceAccuracy) : "",
              },
            });
          }}
        />

        <DiscoverNearYouButton onPress={() => {}} />
      </ScrollView>
    </View>
  );
}
