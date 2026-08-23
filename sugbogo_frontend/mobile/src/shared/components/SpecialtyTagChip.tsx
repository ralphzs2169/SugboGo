import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { getSpecialtyTagColor } from "@/shared/constants/specialtyTagColors";
import type { SpecialtyTagColor } from "@/shared/types/specialtyTag.types";

type SpecialtyTagChipProps = {
  tag: {
    name: string;
    color: SpecialtyTagColor;
  };
  size?: "default" | "small";
  isSelected?: boolean;
  isDisabled?: boolean;
  onPress?: () => void;
  showCheckIcon?: boolean;
  showDisabledStyle?: boolean;
  count?: number;
  scaleOnPress?: boolean;
  showVouchCount?: boolean;
};

/**
 * Renders a specialty tag as a reusable visual chip.
 *
 * The chip is presentation-focused and does not manage selection state.
 * Parent components control selection, disabled state, interaction, and
 * optional vouch count display. Vouch interactions use the heart icon to
 * communicate whether the current user has vouched for the specialty.
 */
export default function SpecialtyTagChip({
  tag,
  size = "default",
  isSelected = false,
  isDisabled = false,
  onPress,
  showCheckIcon = false,
  showDisabledStyle = true,
  count,
  scaleOnPress = false,
  showVouchCount = false,
}: SpecialtyTagChipProps) {
  const styles = getSpecialtyTagColor(tag.color);

  const isInteractive = Boolean(onPress);
  const isSmall = size === "small";

  return (
    <Pressable
      onPress={onPress}
      disabled={!isInteractive || isDisabled}
      style={({ pressed }) => ({
        transform: [
          {
            scale: scaleOnPress && pressed ? 1.05 : 1,
          },
        ],
      })}
      className={`mb-2 mr-2 flex-row items-center rounded-full ${
        isSmall ? "px-2.5 py-1" : "px-3.5 py-2"
      } ${styles.background} ${
        isSelected && !showVouchCount && !scaleOnPress
          ? `border ${styles.selectedBorder} border-2`
          : ""
      } ${isDisabled && showDisabledStyle ? "opacity-50" : ""}`}
    >
      {showCheckIcon && isSelected && !showVouchCount && (
        <MaterialCommunityIcons
          name="check"
          size={isSmall ? 12 : 16}
          color={styles.icon}
          style={{ marginRight: 4 }}
        />
      )}

      {/* Specialty name */}
      <Text
        className={`font-semibold uppercase ${
          isSmall ? "text-[10px]" : "text-sm"
        } ${styles.text}`}
      >
        {tag.name}
      </Text>

      {/* Vouch indicator */}
      {showVouchCount && count !== undefined && (
        <View
          className={`ml-2 flex-row items-center ${
            isSmall ? "pl-1.5" : "pl-2"
          }`}
        >
          <View
            className={`mr-1 ${isSmall ? "h-3" : "h-4"} w-px bg-black/10`}
          />

          <MaterialCommunityIcons
            name={isSelected ? "heart" : "heart-outline"}
            size={isSmall ? 13 : 16}
            color={styles.icon}
          />

          <Text
            className={`ml-1 font-bold ${
              isSmall ? "text-[10px]" : "text-xs"
            } ${styles.text}`}
          >
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
