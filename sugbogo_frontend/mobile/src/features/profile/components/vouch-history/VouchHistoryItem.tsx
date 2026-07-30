import { View, Text, Image, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";

type Props = {
  msmeName: string;
  photoUrl: string;
  category: string;
  tag: string;
  date: string;
  isEditing?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export default function VouchHistoryItem({
  msmeName,
  photoUrl,
  category,
  tag,
  date,
  isEditing = false,
  isSelected = false,
  onSelect,
  onEdit,
  onDelete,
}: Props) {
  return (
    <Pressable
      onPress={isEditing ? onSelect : undefined}
      className="mb-3 flex-row items-center rounded-md bg-surface p-4"
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

      <Image source={{ uri: photoUrl }} className="mr-4 h-20 w-20 rounded-md" />

      <View className="flex-1">
        <Text className="text-base font-bold text-text-primary" numberOfLines={1}>
          {msmeName}
        </Text>
        <View className="mt-1 self-start rounded-full bg-orange-100 px-2 py-0.5">
          <Text className="text-xs font-medium text-brand">{category}</Text>
        </View>
        <View className="mt-1 flex-row items-center">
          <MaterialCommunityIcons name="heart" size={12} color={theme.extends.colors.brand} />
          <Text className="ml-1 text-xs text-text-secondary">
            Vouched for &quot;{tag}&quot;
          </Text>
        </View>
        <View className="mt-1 flex-row items-center">
          <MaterialCommunityIcons
            name="calendar-outline"
            size={12}
            color={theme.extends.colors.text.tertiary}
          />
          <Text className="ml-1 text-xs text-text-tertiary">{date}</Text>
        </View>
      </View>

      {!isEditing && (
        <Pressable onPress={onEdit} hitSlop={12} className="p-2">
          <MaterialCommunityIcons
            name="pencil-outline"
            size={20}
            color={theme.extends.colors.text.secondary}
          />
        </Pressable>
      )}
    </Pressable>
  );
}