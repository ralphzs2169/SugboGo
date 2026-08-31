import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { CATEGORY_ICONS } from "@/shared/constants/categoryIcons";

type Props = {
  category: "Culinary" | "Leisure" | "Creative";
};

export default function MapMarkerIcon({ category }: Props) {
  return (
    <View
      className="h-9 w-9 items-center justify-center rounded-full bg-brand"
      style={{ borderWidth: 2, borderColor: "#FFFFFF", elevation: 4 }}
    >
      <MaterialCommunityIcons
        name={CATEGORY_ICONS[category]}
        size={18}
        color="#FFFFFF"
      />
    </View>
  );
}