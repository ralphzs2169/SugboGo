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
 * Renders a specialty tag as a reusable visual chip.
 *
 * Display mode always uses the specialty's assigned color. Selection modes
 * use a white outlined appearance until selected, then apply the specialty's
 * assigned color. The specialty icon and selection indicators can be shown
 * independently depending on the chip's context.
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
  const isSelectionMode = mode === "registration" || mode === "filter";
  const isInteractive = Boolean(onPress);

  const useColoredStyle = !isSelectionMode || isSelected;
  const useDisabledStyle = isSelectionMode && isDisabled && showDisabledStyle;

  const textColor = useColoredStyle ? styles.text : "text-black";
  const iconColor = useColoredStyle
    ? styles.icon
    : theme.extends.colors.text.secondary;

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
      } ${isSmall ? "px-2.5 py-1" : "min-h-12 px-3.5 py-1.5"} ${
        useDisabledStyle
          ? "border border-border-primary bg-gray-200 opacity-40"
          : isSelectionMode
            ? isSelected
              ? styles.background
              : "border border-border-primary bg-white"
            : styles.background
      }`}
    >
      {/* Specialty icon */}
      {showIcon && (
        <MaterialCommunityIcons
          name={specialtyIcon}
          size={isSmall ? 13 : 16}
          color={
            useDisabledStyle ? theme.extends.colors.text.tertiary : iconColor
          }
          style={{ marginRight: 5 }}
        />
      )}

      {/* Specialty name */}
      <AppText
        weight="semibold"
        className={`${isSmall ? "text-[10px]" : "text-sm"} ${
          useDisabledStyle
            ? "text-gray-400"
            : isSelectionMode && !isSelected
              ? "text-text-secondary"
              : textColor
        }`}
        numberOfLines={2}
      >
        {tag.name}
      </AppText>

      {/* Selected-state indicator */}
      {/* {showSelectionIndicator && isSelected && (
        <MaterialCommunityIcons
          name="check-circle"
          size={isSmall ? 13 : 16}
          color={iconColor}
          style={{ marginLeft: 5 }}
        />
      )} */}

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
            color={
              useDisabledStyle ? theme.extends.colors.text.tertiary : iconColor
            }
          />

          <AppText
            weight="bold"
            className={`ml-1 ${isSmall ? "text-[10px]" : "text-xs"} ${
              useDisabledStyle ? "text-gray-400" : textColor
            }`}
          >
            {count}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}
