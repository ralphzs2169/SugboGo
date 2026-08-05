import { Pressable, ImageBackground, View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { TAG_COLORS, DEFAULT_TAG_COLOR } from "../../constants/tagColors";

type Props = {
  name: string;
  photoUrl: string;
  tags: string[];
  location: string;
  onPress: () => void;
};

export default function InterestCard({ name, photoUrl, tags, location, onPress }: Props) {
  return (
    <Pressable onPress={onPress} className="mr-3 w-44 overflow-hidden rounded-md bg-surface">
      <ImageBackground
        source={{ uri: photoUrl }}
        className="h-40 justify-end p-2"
        imageStyle={{ borderTopLeftRadius: 8, borderTopRightRadius: 8 }}
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

      <View className="flex-row items-center px-2 py-2">
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