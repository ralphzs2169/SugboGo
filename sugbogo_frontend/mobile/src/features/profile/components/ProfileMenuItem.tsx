import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, View } from "react-native";

import SafePressable from "@/shared/components/SafePressable";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

type BadgeVariant = "default" | "success" | "warning" | "error";

type ProfileMenuItemProps = {
  title: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  badge?: string | number;
  badgeVariant?: BadgeVariant;
  variant?: "default" | "danger";
  showChevron?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
};

const badgeColors: Record<BadgeVariant, string> = {
  default: "bg-brand",
  success: "bg-success",
  warning: "bg-yellow-500",
  error: "bg-error",
};

/**
 * Displays an interactive row within a profile menu section.
 *
 * Supports navigation, badges, destructive styling, and lightweight loading
 * feedback for actions that transition the user between app experiences.
 */
export default function ProfileMenuItem({
  title,
  icon,
  onPress,
  badge,
  badgeVariant = "default",
  variant = "default",
  showChevron = true,
  disabled = false,
  isLoading = false,
}: ProfileMenuItemProps) {
  const isDanger = variant === "danger";
  const isDisabled = disabled || isLoading;

  const iconColor = isDanger
    ? theme.extends.colors.error
    : theme.extends.colors.text.secondary;

  return (
    <SafePressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{
        disabled: isDisabled,
        busy: isLoading,
      }}
      className={`cursor-pointer flex-row items-center px-4 py-3 active:opacity-70 ${
        isDisabled ? "opacity-60" : ""
      }`}
    >
      {/* Menu item identity */}
      <MaterialCommunityIcons name={icon} size={24} color={iconColor} />

      <AppText
        weight="medium"
        className={`ml-4 flex-1 text-base ${
          isDanger ? "text-text-error" : "text-text-primary"
        }`}
        numberOfLines={1}
      >
        {title}
      </AppText>

      {/* Optional badge */}
      {badge !== undefined && badge !== null && !isLoading && (
        <View
          className={`mr-3 min-w-[22px] rounded-full px-2 py-1 ${badgeColors[badgeVariant]}`}
        >
          <AppText weight="semibold" className="text-center text-xs text-white">
            {badge}
          </AppText>
        </View>
      )}

      {/* Trailing state */}
      {isLoading ? (
        <ActivityIndicator size="small" color={theme.extends.colors.brand} />
      ) : (
        showChevron && (
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={theme.extends.colors.text.tertiary}
          />
        )
      )}
    </SafePressable>
  );
}
