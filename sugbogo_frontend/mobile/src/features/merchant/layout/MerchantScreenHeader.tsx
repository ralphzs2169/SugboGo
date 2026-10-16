import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { TouchableOpacity, View } from "react-native";

import AppText from "@/shared/components/AppText";

type MerchantScreenHeaderProps = {
  title: string;
  actionIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onActionPress?: () => void;
  rightAccessory?: ReactNode;
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
  rightAccessory,
}: MerchantScreenHeaderProps) {
  return (
    <View className="flex-row items-center justify-between bg-background px-6 py-4">
      {/* Screen title */}
      <AppText
        weight="bold"
        numberOfLines={1}
        className="min-w-0 flex-1 text-2xl text-text-primary"
      >
        {title}
      </AppText>

      {/* Optional screen action */}
      {rightAccessory ??
        (actionIcon && onActionPress ? (
          <TouchableOpacity
            onPress={onActionPress}
            activeOpacity={0.7}
            className="cursor-pointer rounded-full p-2"
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name={actionIcon}
              size={22}
              color="#14251F"
            />
          </TouchableOpacity>
        ) : null)}
    </View>
  );
}
