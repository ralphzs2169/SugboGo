import { View, Text, Image, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";

type Props = {
  msmeName: string;
  category: string;
  comment: string;
  date: string;
  photoUrl?: string;
  isEditing?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
};

export default function ReviewCard({
  msmeName,
  category,
  comment,
  date,
  photoUrl,
  isEditing = false,
  isSelected = false,
  onSelect,
}: Props) {
  return (
    <Pressable
      onPress={isEditing ? onSelect : undefined}
      className="mb-3 flex-row rounded-md bg-surface p-4"
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

      <View className="flex-1">
        <Text className="text-base font-bold text-text-primary">{msmeName}</Text>
        <View className="mt-1 self-start rounded-full bg-orange-100 px-2 py-0.5">
          <Text className="text-xs font-medium text-brand">{category}</Text>
        </View>
        <View className="mt-1 flex-row items-center">
          <MaterialCommunityIcons
            name="calendar-outline"
            size={12}
            color={theme.extends.colors.text.tertiary}
          />
          <Text className="ml-1 text-xs text-text-tertiary">{date}</Text>
        </View>

        <Text className="mt-2 text-sm text-text-secondary">{comment}</Text>

        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            className="mt-3 h-32 w-full rounded-md"
          />
        ) : null}
      </View>
    </Pressable>
  );
}