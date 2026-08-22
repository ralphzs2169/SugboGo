import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

type MerchantScreenHeaderProps = {
  title: string;
  actionIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onActionPress?: () => void;
};

/**
 * Provides a consistent header for merchant tab screens.
 *
 * Displays the current screen title and an optional contextual action,
 * while keeping the header visually consistent across merchant screens.
 */
export default function MerchantScreenHeader({
  title,
  actionIcon,
  onActionPress,
}: MerchantScreenHeaderProps) {
  return (
    <View className="flex-row items-center justify-between bg-background px-6 py-4">
      {/* Screen title */}
      <Text className="text-2xl font-bold text-text-primary">{title}</Text>

      {/* Optional screen action */}
      {actionIcon && onActionPress && (
        <TouchableOpacity
          onPress={onActionPress}
          activeOpacity={0.7}
          className="cursor-pointer rounded-full p-2"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name={actionIcon} size={22} color="#14251F" />
        </TouchableOpacity>
      )}
    </View>
  );
}
