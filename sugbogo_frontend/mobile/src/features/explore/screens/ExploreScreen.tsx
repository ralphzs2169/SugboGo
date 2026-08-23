import { router } from "expo-router";
import { View, ScrollView } from "react-native";
import { useState } from "react";

import ExploreTopBar from "../components/ExploreTopBar";
import HiddenGemsSection from "../components/hidden-gems/HiddenGemsSection";
import InterestsSection from "../components/interests/InterestsSection";
import DiscoverNearYouButton from "../components/DiscoverNearYouButton";
import DiscoverMoreSection from "../components/discover-more/DiscoverMoreSection";
import TrendingSection from "../components/trending/TrendingSection";
import NewBusinessesSection from "../components/new-businesses/NewBusinessesSection";

export default function ExploreScreen() {
  const [selectedCategory, setSelectedCategory] = useState("All");

  const handleBusinessPress = (businessId: number) => {
    router.push({
      pathname: "/business/[businessId]",
      params: {
        businessId: businessId.toString(),
      },
    });
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
      >
        <HiddenGemsSection selectedCategory={selectedCategory} />

        <InterestsSection selectedCategory={selectedCategory} />

        <DiscoverMoreSection selectedCategory={selectedCategory} />

        <TrendingSection selectedCategory={selectedCategory} />

        <NewBusinessesSection onBusinessPress={handleBusinessPress} />

        <DiscoverNearYouButton onPress={() => {}} />
      </ScrollView>
    </View>
  );
}
