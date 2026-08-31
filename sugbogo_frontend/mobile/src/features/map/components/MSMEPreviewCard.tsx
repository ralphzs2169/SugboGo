import { View, Text, Image, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { TAG_COLORS, DEFAULT_TAG_COLOR } from "@/shared/constants/tagColors";
import { HiddenGem } from "@/shared/constants/mockExploreData";

type Props = {
  gem: HiddenGem;
  onClose: () => void;
  onVisitProfile: () => void;
};

export default function MSMEPreviewCard({ gem, onClose, onVisitProfile }: Props) {
  return (
    <View
      className="absolute bottom-0 left-0 right-0 rounded-t-card bg-surface p-md"
      style={{ elevation: 8 }}
    >
      <Pressable onPress={onClose} className="absolute right-md top-md z-10" hitSlop={12}>
        <MaterialCommunityIcons
          name="close"
          size={20}
          color={theme.extends.colors.text.secondary}
        />
      </Pressable>

      <View className="flex-row items-center">
        <Image source={{ uri: gem.photoUrl }} className="h-24 w-24 rounded-input mr-md" />

        <View className="flex-1 pr-lg">
          <Text className="text-md font-bold text-text-primary" numberOfLines={1}>
            {gem.name}
          </Text>
          <View className="mt-xs flex-row items-center">
            <MaterialCommunityIcons name="map-marker-outline" size={12} color={theme.extends.colors.text.tertiary} />
            <Text className="ml-xs text-small text-text-tertiary" numberOfLines={1}>
              {gem.location}
            </Text>
          </View>

          <View className="mt-sm flex-row flex-wrap gap-xs">
            {gem.tags.map((tag) => {
              const color = TAG_COLORS[tag] ?? DEFAULT_TAG_COLOR;
              return (
                <View key={tag} className={`rounded-tag px-sm py-xs ${color.bg}`}>
                  <Text className={`text-xs font-medium ${color.text}`}>{tag}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <Pressable
        onPress={onVisitProfile}
        className="mt-md flex-row items-center justify-center rounded-btn bg-brand py-sm"
      >
        <MaterialCommunityIcons name="navigation-variant" size={16} color="#FFFFFF" />
        <Text className="ml-xs text-body font-bold text-white">Visit Profile</Text>
      </Pressable>
    </View>
  );
}