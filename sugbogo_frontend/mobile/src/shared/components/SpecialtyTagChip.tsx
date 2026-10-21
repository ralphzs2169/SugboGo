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
  size?: "default" | "medium" | "small" | "xs";
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
 * Displays a reusable specialty tag across display and selection contexts.
 *
 * Display mode always uses soft specialty colors. Filter and registration
 * modes use neutral unselected states and soft specialty colors with a
 * colored border when selected.
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
  const isExtraSmall = size === "xs";
  const isMedium = size === "medium";
  const isDisplayMode = mode === "display";
  const isSelectionMode = mode === "registration" || mode === "filter";
  const isInteractive = Boolean(onPress);

  const useDisabledStyle = isSelectionMode && isDisabled && showDisabledStyle;

  const sizeClassName = isExtraSmall
    ? "px-2 py-0.5"
    : isSmall
      ? "px-2.5 py-1"
      : isMedium
        ? "px-4 py-2"
        : "min-h-12 px-3.5 py-1.5";

  const textSizeClassName = isExtraSmall
    ? "text-[9px]"
    : isSmall
      ? "text-[10px]"
      : "text-sm";
  const countSizeClassName = isExtraSmall
    ? "text-[9px]"
    : isSmall
      ? "text-[10px]"
      : "text-xs";
  const iconSize = isExtraSmall ? 11 : isSmall ? 13 : isMedium ? 15 : 16;

  const textColor = useDisabledStyle
    ? "text-gray-400"
    : isDisplayMode || isSelected
      ? styles.softText
      : "text-text-secondary";

  const iconColor = useDisabledStyle
    ? theme.extends.colors.text.tertiary
    : isDisplayMode || isSelected
      ? styles.softIcon
      : theme.extends.colors.text.secondary;

  const backgroundClassName = useDisabledStyle
    ? "border border-border-primary bg-gray-200 opacity-40"
    : isSelectionMode && !isSelected
      ? "border border-border-primary bg-white"
      : styles.softBackground;

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
        ...(isSelectionMode && isSelected && !useDisabledStyle
          ? {
              borderWidth: 1,
              borderColor: styles.borderColor,
            }
          : {}),
      })}
      className={`${isExtraSmall ? "mb-1 mr-1" : "mb-2 mr-2"} flex-row items-center justify-center rounded-full ${
        isInteractive ? "cursor-pointer" : ""
      } ${sizeClassName} ${backgroundClassName}`}
    >
      {/* Specialty icon */}
      {showIcon && (
        <MaterialCommunityIcons
          name={specialtyIcon}
          size={iconSize}
          color={iconColor}
          style={{ marginRight: isExtraSmall ? 3 : 5 }}
        />
      )}

      {/* Specialty name */}
      <AppText
        weight="semibold"
        className={`${textSizeClassName} ${textColor}`}
        numberOfLines={2}
      >
        {tag.name}
      </AppText>

      {/* Selected-state indicator */}
      {showSelectionIndicator && isSelected && (
        <MaterialCommunityIcons
          name="check-circle"
          size={iconSize}
          color={iconColor}
          style={{ marginLeft: isExtraSmall ? 3 : 5 }}
        />
      )}

      {/* Vouch indicator */}
      {showVouchIndicator && isSelected && (
        <MaterialCommunityIcons
          name="heart"
          size={iconSize}
          color={iconColor}
          style={{ marginLeft: isExtraSmall ? 3 : 5 }}
        />
      )}

      {/* Vouch count */}
      {showVouchCount && count !== undefined && (
        <View
          className={`flex-row items-center ${isSmall ? "ml-1.5" : "ml-2"}`}
        >
          <View
            className={`mr-1 w-px bg-black/10 ${isSmall ? "h-3" : "h-4"}`}
          />

          <MaterialCommunityIcons
            name={isSelected ? "heart" : "heart-outline"}
            size={iconSize}
            color={iconColor}
          />

          <AppText
            weight="bold"
            className={`ml-1 ${countSizeClassName} ${textColor}`}
          >
            {count}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}
