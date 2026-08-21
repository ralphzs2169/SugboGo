import { View, Text, Image, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { CATEGORY_ICONS } from "@/shared/constants/categoryIcons";

type Props = {
  msmeName: string;
  msmeLocation: string;
  msmeCategory: "Culinary" | "Leisure" | "Creative";
  msmePhotoUrl: string;
  onPress: () => void;
};

export default function BusinessPreviewCard({
  msmeName,
  msmeLocation,
  msmeCategory,
  msmePhotoUrl,
  onPress,
}: Props) {
  return (
    <View className="mx-4 mb-3 flex-row items-center rounded-card bg-background p-2">
      <Image source={{ uri: msmePhotoUrl }} className="h-10 w-10 rounded-input mr-3" />

      <View className="flex-1">
        <Text className="text-sm font-bold text-text-primary" numberOfLines={1}>
          {msmeName}
        </Text>
        <Text className="text-xs text-text-tertiary" numberOfLines={1}>
          {msmeLocation}
        </Text>
      </View>

      <MaterialCommunityIcons
        name={CATEGORY_ICONS[msmeCategory]}
        size={16}
        color={theme.extends.colors.text.tertiary}
        style={{ marginRight: 8 }}
      />

      <Pressable
        onPress={onPress}
        className="h-8 w-8 items-center justify-center rounded-full bg-brand"
      >
        <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}