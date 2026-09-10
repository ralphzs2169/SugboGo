import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import AppText from "@/shared/components/AppText";

import { getSpecialtyTagColor } from "@/shared/constants/specialtyTagColors";
import type { SpecialtyTagColor } from "@/shared/types/specialtyTag.types";

type SpecialtyTagChipProps = {
  tag: {
    name: string;
    color: SpecialtyTagColor;
  };
  mode?: "display" | "registration";
  size?: "default" | "small";
  isSelected?: boolean;
  isDisabled?: boolean;
  onPress?: () => void;
  showDisabledStyle?: boolean;
  count?: number;
  scaleOnPress?: boolean;
  showVouchCount?: boolean;
  showVouchIndicator?: boolean;
  showSelectionIndicator?: boolean;
};

/**
 * Renders a specialty tag as a reusable visual chip.
 *
 * Display mode always uses the specialty's assigned color. Registration mode
 * uses a white outlined appearance for unselected tags and the specialty's
 * filled color once selected. Disabled registration tags use a muted visual
 * treatment to indicate that they cannot currently be selected.
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
  showVouchCount = false,
  showVouchIndicator = false,
  showSelectionIndicator = false,
}: SpecialtyTagChipProps) {
  const styles = getSpecialtyTagColor(tag.color);

  const isSmall = size === "small";
  const isRegistration = mode === "registration";
  const isInteractive = Boolean(onPress);

  const useColoredStyle = !isRegistration || isSelected;
  const useDisabledStyle = isRegistration && isDisabled && showDisabledStyle;

  const textColor = useColoredStyle ? styles.text : "text-black";
  const iconColor = useColoredStyle ? styles.icon : "#000000";

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

        // Registration selected state uses the specialty color.
        ...(isRegistration && isSelected
          ? {
              borderColor: styles.borderColor,
            }
          : {}),
      })}
      className={`mb-2 mr-2 flex-row items-center justify-center rounded-full ${
        isSmall ? "px-2.5 py-1" : "min-h-12 px-3.5 py-2"
      } ${
        useDisabledStyle
          ? "border border-border-primary bg-gray-200 opacity-40"
          : isRegistration
            ? isSelected
              ? styles.background
              : "border border-border-primary bg-white"
            : styles.background
      }`}
    >
      {/* Specialty name */}
      <AppText
        weight="semibold"
        className={` ${isSmall ? "text-[10px]" : "text-sm"} ${
          useDisabledStyle
            ? "text-gray-400"
            : isRegistration && !isSelected
              ? "text-text-secondary"
              : textColor
        }`}
        numberOfLines={2}
      >
        {tag.name}
      </AppText>

      {/* Generic selected-state indicator */}
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
            color={useDisabledStyle ? "#9CA3AF" : iconColor}
          />

          <AppText
            weight="bold"
            className={`ml-1  ${isSmall ? "text-[10px]" : "text-xs"} ${
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
