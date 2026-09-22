import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { formatTime } from "@/features/merchant/utils/merchant-application/operatingHours.utils";

type TimeInputProps = {
  label: string;
  value: string;
  error?: string;
  onPress: () => void;
};

/**
 * Displays a selectable operating-hours time field.
 *
 * Shows the current formatted time and validation feedback while opening the
 * native time picker when pressed.
 */
export default function TimeInput({
  label,
  value,
  error,
  onPress,
}: TimeInputProps) {
  return (
    <View className="flex-1">
      {/* Field label */}
      <AppText
        weight="semibold"
        className="mb-1.5 text-xs uppercase tracking-wide text-text-tertiary"
      >
        {label}
      </AppText>

      {/* Time selection */}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${
          value ? formatTime(value) : "Select time"
        }`}
        className={
          error
            ? "cursor-pointer rounded-md border border-border-error bg-error px-3.5 py-3 active:opacity-70"
            : "cursor-pointer rounded-md border border-border-primary bg-surface px-3.5 py-3 active:bg-surface-secondary"
        }
      >
        <View className="flex-row items-center justify-between">
          <AppText
            weight={value ? "semibold" : "medium"}
            className={
              value
                ? "text-base text-text-primary"
                : "text-base text-text-tertiary"
            }
          >
            {value ? formatTime(value) : "Select time"}
          </AppText>

          <MaterialCommunityIcons
            name="clock-outline"
            size={18}
            color={theme.extends.colors.text.secondary}
          />
        </View>
      </Pressable>

      {/* Validation feedback */}
      {error && (
        <AppText className="mt-1 text-xs text-text-error">{error}</AppText>
      )}
    </View>
  );
}
