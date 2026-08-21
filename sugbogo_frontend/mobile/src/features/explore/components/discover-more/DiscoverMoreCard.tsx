import { Pressable, ImageBackground, View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { TAG_COLORS, DEFAULT_TAG_COLOR } from "@/shared/constants/tagColors";
import { CATEGORY_ICONS } from "@/shared/constants/categoryIcons";

type Props = {
  name: string;
  photoUrl: string;
  tags: string[];
  category: "Culinary" | "Leisure" | "Creative";
  distanceKm: number;
  onPress: () => void;
};

export default function DiscoverMoreCard({ name, photoUrl, tags, category, distanceKm, onPress }: Props) {
  return (
    <Pressable onPress={onPress} className="w-56 overflow-hidden rounded-card bg-surface">
      <ImageBackground
        source={{ uri: photoUrl }}
        className="h-52 justify-end p-2"
        imageStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
      >
        <Text className="text-sm font-bold text-white" numberOfLines={1}>
          {name}
        </Text>
        <View className="mt-1 flex-row flex-wrap gap-1">
          {tags.map((tag) => {
            const color = TAG_COLORS[tag] ?? DEFAULT_TAG_COLOR;
            return (
              <View key={tag} className={`rounded-full px-2 py-0.5 ${color.bg}`}>
                <Text className={`text-[10px] font-medium ${color.text}`}>{tag}</Text>
              </View>
            );
          })}
        </View>
      </ImageBackground>

      <View className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-white">
                  <MaterialCommunityIcons
                    name={CATEGORY_ICONS[category]}
                    size={20}
                    color={theme.extends.colors.brand}
                  />
                </View>

      <View className="flex-row px-2 py-2">
  <Text className="text-xs text-text-tertiary">
    {distanceKm}KM
  </Text>
  <Text className="mx-1 text-xs text-text-tertiary">•</Text>
  <Text className="text-xs text-text-tertiary">
    {category.toUpperCase()}
  </Text>
</View>

    </Pressable>
  );
}