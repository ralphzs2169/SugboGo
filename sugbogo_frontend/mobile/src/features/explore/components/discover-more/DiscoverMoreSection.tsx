import { View, Text, ScrollView } from "react-native";
import DiscoverMoreCard from "./DiscoverMoreCard";
import { MOCK_HIDDEN_GEMS } from "../../constants/mockExploreData";

type Props = {
  selectedCategory: string;
};

export default function DiscoverMoreSection({ selectedCategory }: Props) {
  const discoverGems = MOCK_HIDDEN_GEMS.filter((gem) => {
    const matchesDiscover = gem.isDiscoverMore;
    const matchesCategory =
      selectedCategory === "All" || gem.category === selectedCategory;
    return matchesDiscover && matchesCategory;
  });
  if (discoverGems.length === 0) return null;

  return (
    <View className="mt-6">
      <View className="px-4 mb-3">
        <Text className="text-lg font-bold text-text-primary">Discover more in Cebu</Text>
        <Text className="text-sm text-text-secondary">The City&apos;s Most Vouched MSMEs</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-4 gap-3">
        {discoverGems.map((gem) => (
          <DiscoverMoreCard
            key={gem.id}
            name={gem.name}
            photoUrl={gem.photoUrl}
            tags={gem.tags}
            category={gem.category}
            distanceKm={gem.distanceKm ?? 0}
            onPress={() => {}}
          />
        ))}
      </ScrollView>
    </View>
  );
}