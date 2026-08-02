import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Day } from "@/features/merchant/constants/operatingHours.constants";

type ApplyDayOptionProps = {
  day: Day;
  isSelected: boolean;
  onPress: () => void;
};

/**
 * Displays a selectable day option for applying an operating schedule.
 */
export default function ApplyDayOption({
  day,
  isSelected,
  onPress,
}: ApplyDayOptionProps) {
  return (
    <Pressable
      className={
        isSelected
          ? "flex-row items-center justify-between rounded-lg bg-primary/10 px-3 py-3"
          : "flex-row items-center justify-between rounded-lg px-3 py-3"
      }
      onPress={onPress}
    >
      <Text
        className={
          isSelected
            ? "text-sm font-semibold capitalize text-primary"
            : "text-sm font-medium capitalize text-text-primary"
        }
      >
        {day}
      </Text>

      <View
        className={
          isSelected
            ? "h-5 w-5 items-center justify-center rounded-full  bg-brand"
            : "h-5 w-5 rounded-full border border-border-secondary bg-white"
        }
      >
        {isSelected && (
          <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" />
        )}
      </View>
    </Pressable>
  );
}
