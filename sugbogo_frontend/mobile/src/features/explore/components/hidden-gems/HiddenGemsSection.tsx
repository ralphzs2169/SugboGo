import { ScrollView } from "react-native";
import HiddenGemCard from "./HiddenGemCard";
import { MOCK_HIDDEN_GEMS } from "../../constants/mockExploreData";

type Props ={
    selectedCategory: string;
}
export default function HiddenGemsSection({selectedCategory }: Props) {
    const filteredGems = 
    selectedCategory === "All"
    ? MOCK_HIDDEN_GEMS
    : MOCK_HIDDEN_GEMS.filter((gem) => gem.category === selectedCategory);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="px-4"
    >
      {filteredGems.map((gem) => (
        <HiddenGemCard
          key={gem.id}
          name={gem.name}
          photoUrl={gem.photoUrl}
          tags={gem.tags}
          onPress={() => {}}
        />
      ))}
    </ScrollView>
  );
}