import { Pressable, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { SpecialtyTagOption } from "@/features/merchant/types/registration/registrationOption.types";
import { getSpecialtyTagColor } from "@/shared/constants/specialtyTagColors";

type SpecialtyTagChipProps = {
  tag: SpecialtyTagOption;
  size?: "default" | "small";
  isSelected?: boolean;
  isDisabled?: boolean;
  onPress?: () => void;
  showCheckIcon?: boolean;
  showDisabledStyle?: boolean;
};

/**
 * Renders a specialty tag as a reusable visual chip.
 *
 * The chip is presentation-focused and does not manage selection state.
 * Parent components control whether the tag is selected, disabled, or
 * interactive through the provided props.
 *
 * Supports both interactive and read-only usage:
 * - Interactive: provide `onPress`.
 * - Read-only: omit `onPress`.
 * - Selected: set `isSelected` to true.
 * - Disabled: set `isDisabled` to true.
 *
 * Tag colors are derived from the tag's configured color and centralized
 * through `getSpecialtyTagColor`.
 */
export default function SpecialtyTagChip({
  tag,
  size = "default",
  isSelected = false,
  isDisabled = false,
  onPress,
  showCheckIcon = false,
  showDisabledStyle = true,
}: SpecialtyTagChipProps) {
  const styles = getSpecialtyTagColor(tag.color);

  const isInteractive = Boolean(onPress);
  const isSmall = size === "small";

  return (
    <Pressable
      onPress={onPress}
      disabled={!isInteractive || isDisabled}
      className={`mb-2 mr-2 flex-row items-center rounded-full ${
        isSmall ? "px-2 py-0.5" : "px-3 py-2"
      } ${styles.background} ${
        isSelected ? `border ${styles.selectedBorder} border-2` : ""
      } ${isDisabled && showDisabledStyle ? "opacity-40" : ""}`}
    >
      {showCheckIcon && isSelected && (
        <MaterialCommunityIcons
          name="check"
          size={isSmall ? 12 : 16}
          color={styles.icon}
          style={{ marginRight: 4 }}
        />
      )}

      <Text
        className={`font-medium ${
          isSmall ? "text-[10px]" : "text-sm"
        } ${styles.text}`}
      >
        {tag.name}
      </Text>
    </Pressable>
  );
}
