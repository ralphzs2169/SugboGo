import { View, Text, ScrollView, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import TrendingCard from "./TrendingCard";
import { MOCK_HIDDEN_GEMS } from "../../constants/mockExploreData";

type Props = {
  selectedCategory: string;
};

export default function TrendingSection({ selectedCategory }: Props) {
  const trendingGems = MOCK_HIDDEN_GEMS.filter((gem) => {
    const matchesTrending = gem.isTrending;
    const matchesCategory =
      selectedCategory === "All" || gem.category === selectedCategory;
    return matchesTrending && matchesCategory;
  });


  if (trendingGems.length === 0) return null;

  return (
    <View className="mt-6">
      <View className="flex-row items-center justify-between px-4 mb-3">
        <View className="flex-row items-center">
          <MaterialCommunityIcons name="fire" size={20} color={theme.extends.colors.brand} />
          <Text className="ml-1 text-lg font-bold text-text-primary">Trending Now</Text>
        </View>
        <Pressable onPress={() => {}}>
          <Text className="text-sm font-semibold text-brand">SEE ALL</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-4">
        {trendingGems.map((gem) => (
          <TrendingCard
            key={gem.id}
            name={gem.name}
            photoUrl={gem.photoUrl}
            tags={gem.tags}
            category={gem.category}
            location={gem.location}
            trendDirection={gem.trendDirection ?? "up"}
            trendValue={gem.trendValue ?? 0}
            onPress={() => {}}
          />
        ))}
      </ScrollView>
    </View>
  );
}