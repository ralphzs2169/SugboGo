import { View, Text, ScrollView } from "react-native";
import InterestCard from "./InterestCard";
import { MOCK_HIDDEN_GEMS } from "../../constants/mockExploreData";

export default function InterestsSection() {
  const interestGems = MOCK_HIDDEN_GEMS.filter((gem) => gem.isInterestMatch);

  if (interestGems.length === 0) return null;

  return (
    <View className="mt-6">
      <View className="px-4 mb-3">
        <Text className="text-lg font-bold text-text-primary">Based on your Interests</Text>
        <Text className="text-sm text-text-secondary">Handpicked Gems You'll Love</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-4">
        {interestGems.map((gem) => (
          <InterestCard
            key={gem.id}
            name={gem.name}
            photoUrl={gem.photoUrl}
            tags={gem.tags}
            location={gem.location}
            onPress={() => {}}
          />
        ))}
      </ScrollView>
    </View>
  );
}