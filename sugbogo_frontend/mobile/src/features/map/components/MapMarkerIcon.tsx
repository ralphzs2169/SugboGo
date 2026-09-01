import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CATEGORY_ICONS } from "@/shared/constants/categoryIcons";

type Props = {
  category: "Culinary" | "Leisure" | "Creative";
  isSelected?: boolean;
};

export default function MapMarkerIcon({ category, isSelected = false }: Props) {
  return (
    <View
      className="items-center justify-center rounded-full bg-brand"
      style={{
        height: isSelected ? 42 : 36,
        width: isSelected ? 42 : 36,
        borderWidth: 2,
        borderColor: "#FFFFFF",
        elevation: 4,
      }}
    >
      <MaterialCommunityIcons
        name={CATEGORY_ICONS[category]}
        size={isSelected ? 20 : 18}
        color="#FFFFFF"
      />
    </View>
  );
}