import { View, Text, Image, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";

type Props = {
  name: string;
  photoUrl: string;
  category: string;
  location: string;
  isEditing?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onRemove: () => void;
  onPress: () => void;
};

export default function PocketCard({
  name,
  photoUrl,
  category,
  location,
  isEditing = false,
  isSelected = false,
  onSelect,
  onRemove,
  onPress,
}: Props) {
  return (
    <Pressable
      onPress={isEditing ? onSelect : onPress}
      className="mb-3 flex-row items-center rounded-md bg-surface p-4 active:opacity-70"
    >
      {isEditing && (
        <View
          className={`mr-3 h-5 w-5 items-center justify-center rounded border ${
            isSelected ? "bg-brand border-brand" : "border-border"
          }`}
        >
          {isSelected && (
            <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
          )}
        </View>
      )}

      <Image source={{ uri: photoUrl }} className="mr-4 h-24 w-24 rounded-md" />

      <View className="flex-1">
        <Text className="text-base font-bold text-text-primary" numberOfLines={1}>
          {name}
        </Text>
        <View className="mt-1 self-start rounded-full bg-orange-100 px-2 py-0.5">
          <Text className="text-xs font-medium text-brand">{category}</Text>
        </View>
        <View className="mt-1 flex-row items-center">
          <MaterialCommunityIcons
            name="map-marker-outline"
            size={12}
            color={theme.extends.colors.text.tertiary}
          />
          <Text className="ml-1 text-xs text-text-tertiary" numberOfLines={1}>
            {location}
          </Text>
        </View>
      </View>

      {!isEditing && (
        <Pressable onPress={onRemove} hitSlop={12} className="p-2">
          <MaterialCommunityIcons
            name="trash-can-outline"
            size={20}
            color={theme.extends.colors.error}
          />
        </Pressable>
      )}
    </Pressable>
  );
}