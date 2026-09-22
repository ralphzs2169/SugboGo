import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import AppText from "@/shared/components/AppText";
import type { Day } from "@/features/merchant/constants/registration/operatingHours.constants";

type ApplyDayOptionProps = {
  day: Day;
  isSelected: boolean;
  onPress: () => void;
};

/**
 * Displays a selectable day when copying an operating schedule.
 *
 * Uses a restrained selected state and check indicator to show which days will
 * receive the current schedule.
 */
export default function ApplyDayOption({
  day,
  isSelected,
  onPress,
}: ApplyDayOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={`Apply schedule to ${day}`}
      accessibilityState={{ checked: isSelected }}
      className={
        isSelected
          ? "cursor-pointer flex-row items-center justify-between rounded-lg bg-brand/10 px-3 py-3 active:opacity-70"
          : "cursor-pointer flex-row items-center justify-between rounded-lg px-3 py-3 active:bg-surface-secondary"
      }
    >
      {/* Day identity */}
      <AppText
        weight={isSelected ? "semibold" : "medium"}
        className={
          isSelected
            ? "text-sm capitalize text-brand"
            : "text-sm capitalize text-text-primary"
        }
      >
        {day}
      </AppText>

      {/* Selection indicator */}
      <View
        className={
          isSelected
            ? "h-5 w-5 items-center justify-center rounded-full bg-brand"
            : "h-5 w-5 items-center justify-center rounded-full border border-border-secondary bg-surface"
        }
      >
        {isSelected && (
          <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" />
        )}
      </View>
    </Pressable>
  );
}
