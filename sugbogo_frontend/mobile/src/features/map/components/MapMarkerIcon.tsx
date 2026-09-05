import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { CATEGORY_ICONS } from "@/shared/constants/categoryIcons";

type Props = {
  category: "Culinary" | "Leisure" | "Creative";
  isSelected?: boolean;
};

export default function MapMarkerIcon({ category, isSelected = false }: Props) {
  const teardropSize = isSelected ? 40 : 36;
  const circleSize = isSelected ? 30 : 26;
  const iconSize = isSelected ? 16 : 14;

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        padding: 8,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 3,
        elevation: 6,
      }}
    >
      <View
        style={{
          height: teardropSize,
          width: teardropSize,
          borderRadius: teardropSize / 2,
          borderBottomRightRadius: 0,
          backgroundColor: "#FFFFFF",
          transform: [{ rotate: "45deg" }],
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            height: circleSize,
            width: circleSize,
            borderRadius: circleSize / 2,
            backgroundColor: "#F27F0D",
            transform: [{ rotate: "-45deg" }],
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons
            name={CATEGORY_ICONS[category]}
            size={iconSize}
            color="#FFFFFF"
          />
        </View>
      </View>
    </View>
  );
}