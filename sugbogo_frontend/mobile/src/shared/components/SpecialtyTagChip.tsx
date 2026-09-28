import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { getSpecialtyTagColor } from "@/shared/constants/specialtyTagColors";
import { getSpecialtyTagIcon } from "@/shared/constants/specialtyTagIcons";
import type { SpecialtyTag } from "@/shared/types/specialtyTag.types";

type SpecialtyTagChipProps = {
  tag: SpecialtyTag;
  mode?: "display" | "registration" | "filter";
  size?: "default" | "small";
  isSelected?: boolean;
  isDisabled?: boolean;
  onPress?: () => void;
  showDisabledStyle?: boolean;
  count?: number;
  scaleOnPress?: boolean;
  showIcon?: boolean;
  showVouchCount?: boolean;
  showVouchIndicator?: boolean;
  showSelectionIndicator?: boolean;
};

/**
 * Renders a reusable specialty-tag chip across display and selection contexts.
 *
 * Display chips use a soft version of the specialty color for a lighter visual
 * treatment, while selected registration and filter chips retain solid colors.
 */
export default function SpecialtyTagChip({
  tag,
  mode = "display",
  size = "default",
  isSelected = false,
  isDisabled = false,
  onPress,
  showDisabledStyle = true,
  count,
  scaleOnPress = false,
  showIcon = false,
  showVouchCount = false,
  showVouchIndicator = false,
  showSelectionIndicator = false,
}: SpecialtyTagChipProps) {
  const styles = getSpecialtyTagColor(tag.color);
  const specialtyIcon = getSpecialtyTagIcon(tag.icon);

  const isSmall = size === "small";
  const isDisplayMode = mode === "display";
  const isSelectionMode = mode === "registration" || mode === "filter";
  const isInteractive = Boolean(onPress);

  const useDisabledStyle = isSelectionMode && isDisabled && showDisabledStyle;

  const textColor = useDisabledStyle
    ? "text-gray-400"
    : isDisplayMode
      ? styles.softText
      : isSelected
        ? styles.text
        : "text-text-secondary";

  const iconColor = useDisabledStyle
    ? theme.extends.colors.text.tertiary
    : isDisplayMode
      ? styles.softIcon
      : isSelected
        ? styles.icon
        : theme.extends.colors.text.secondary;

  const backgroundClassName = useDisabledStyle
    ? "border border-border-primary bg-gray-200 opacity-40"
    : isDisplayMode
      ? styles.softBackground
      : isSelected
        ? styles.background
        : "border border-border-primary bg-white";

  return (
    <Pressable
      onPress={onPress}
      disabled={!isInteractive || isDisabled}
      accessibilityRole={isInteractive ? "button" : undefined}
      accessibilityLabel={isInteractive ? tag.name : undefined}
      accessibilityState={{
        disabled: isDisabled,
        selected: isSelected,
      }}
      style={({ pressed }) => ({
        transform: [
          {
            scale: scaleOnPress && pressed ? 1.05 : 1,
          },
        ],

        ...(isSelectionMode && isSelected
          ? {
              borderColor: styles.borderColor,
            }
          : {}),
      })}
      className={`mb-2 mr-2 flex-row items-center justify-center rounded-full ${
        isInteractive ? "cursor-pointer" : ""
      } ${
        isSmall ? "px-2.5 py-1" : "min-h-12 px-3.5 py-1.5"
      } ${backgroundClassName}`}
    >
      {/* Specialty icon */}
      {showIcon && (
        <MaterialCommunityIcons
          name={specialtyIcon}
          size={isSmall ? 13 : 16}
          color={iconColor}
          style={{ marginRight: 5 }}
        />
      )}

      {/* Specialty name */}
      <AppText
        weight="semibold"
        className={`${isSmall ? "text-[10px]" : "text-sm"} ${textColor}`}
        numberOfLines={2}
      >
        {tag.name}
      </AppText>

      {/* Selected-state indicator */}
      {showSelectionIndicator && isSelected && (
        <MaterialCommunityIcons
          name="check-circle"
          size={isSmall ? 13 : 16}
          color={iconColor}
          style={{ marginLeft: 5 }}
        />
      )}

      {/* Vouch indicator */}
      {showVouchIndicator && isSelected && (
        <MaterialCommunityIcons
          name="heart"
          size={isSmall ? 13 : 16}
          color={iconColor}
          style={{ marginLeft: 5 }}
        />
      )}

      {/* Vouch count */}
      {showVouchCount && count !== undefined && (
        <View
          className={`flex-row items-center ${isSmall ? "ml-1.5" : "ml-2"}`}
        >
          <View
            className={`mr-1 ${isSmall ? "h-3" : "h-4"} w-px bg-black/10`}
          />

          <MaterialCommunityIcons
            name={isSelected ? "heart" : "heart-outline"}
            size={isSmall ? 13 : 16}
            color={iconColor}
          />

          <AppText
            weight="bold"
            className={`ml-1 ${isSmall ? "text-[10px]" : "text-xs"} ${textColor}`}
          >
            {count}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}
