import { Pressable, ImageBackground, View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { TAG_COLORS, DEFAULT_TAG_COLOR } from "../../constants/tagColors";
import { CATEGORY_ICONS } from "../../constants/categoryIcons";

type Props = {
  name: string;
  photoUrl: string;
  tags: string[];
  category: "Culinary" | "Leisure" | "Creative";
  location: string;
  trendDirection: "up" | "down";
  trendValue: number;
  onPress: () => void;
};

export default function TrendingCard({
  name,
  photoUrl,
  tags,
  category,
  location,
  trendDirection,
  trendValue,
  onPress,
}: Props) {
  const isUp = trendDirection === "up";

  return (
    <Pressable onPress={onPress} className="mr-3 w-64 overflow-hidden rounded-md bg-surface">
      <ImageBackground
        source={{ uri: photoUrl }}
        className="h-52 justify-between p-2"
        imageStyle={{ borderTopLeftRadius: 8, borderTopRightRadius: 8 }}
      >
        <View className="flex-row justify-end gap-1">
          <View className="flex-row items-center rounded-full bg-white px-2 py-1">
            <MaterialCommunityIcons
              name={isUp ? "trending-up" : "trending-down"}
              size={12}
              color={isUp ? "#16A34A" : theme.extends.colors.brand}
            />
            <Text
              className={`ml-0.5 text-xs font-bold ${
                isUp ? "text-success" : "text-brand"
              }`}
            >
              {isUp ? "+" : "-"}{trendValue}
            </Text>
          </View>

          <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
            <MaterialCommunityIcons
              name={CATEGORY_ICONS[category]}
              size={16}
              color={theme.extends.colors.brand}
            />
          </View>
        </View>

        <View>
          <Text className="text-base font-bold text-white" numberOfLines={1}>
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
        </View>
      </ImageBackground>

      <View className="flex-row items-center bg-surface px-2 py-2">
        <MaterialCommunityIcons
          name="map-marker-outline"
          size={12}
          color={theme.extends.colors.text.tertiary}
        />  
        <Text className="ml-1 text-xs text-text-tertiary" numberOfLines={1}>
          {location.toUpperCase()}
        </Text>
      </View>
    </Pressable>
  );
}