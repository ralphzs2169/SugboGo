import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { formatTime } from "@/features/merchant/utils/merchant-application/operatingHours.utils";

type TimeInputProps = {
  label: string;
  value: string;
  error?: string;
  onPress: () => void;
};

/**
 * Displays a single operating-hours time field.
 *
 * Shows the field label, selected time, clock icon,
 * and validation error when present.
 */
export default function TimeInput({
  label,
  value,
  error,
  onPress,
}: TimeInputProps) {
  return (
    <View className="flex-1">
      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
        {label}
      </Text>

      <Pressable
        className={
          error
            ? "rounded-md border border-red-300 bg-red-50 px-3.5 py-3"
            : "rounded-md border border-border-primary bg-white px-3.5 py-3"
        }
        onPress={onPress}
      >
        <View className="flex-row items-center justify-between">
          <Text
            className={
              value
                ? "text-base font-semibold text-text-primary"
                : "text-base font-medium text-text-tertiary"
            }
          >
            {value ? formatTime(value) : "Select time"}
          </Text>

          <MaterialCommunityIcons
            name="clock-outline"
            size={18}
            color={theme.extends.colors.text.secondary}
          />
        </View>
      </Pressable>

      {error && <Text className="mt-1 text-xs text-red-600">{error}</Text>}
    </View>
  );
}
