import { Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import TimeInput from "./time-input/TimeInput";
import TimePicker from "./time-input/TimePicker";
import { theme } from "@/constants/theme";
import { DateTimePickerEvent } from "@react-native-community/datetimepicker";

type TimeField = "openTime" | "closeTime";

type TimeFieldsProps = {
  openTime: string;
  closeTime: string;
  isOvernight: boolean;
  timePicker: {
    field: TimeField;
  } | null;
  onTimePress: (field: TimeField) => void;
  onTimeChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
  openTimeError?: string;
  closeTimeError?: string;
};

/**
 * Displays the opening and closing time controls for a normal
 * operating-hours schedule.
 *
 * Also displays validation errors, an overnight schedule hint,
 * and the native time picker when a time field is being edited.
 */
export default function TimeFields({
  openTime,
  closeTime,
  isOvernight,
  timePicker,
  onTimePress,
  onTimeChange,
  openTimeError,
  closeTimeError,
}: TimeFieldsProps) {
  return (
    <View className="gap-3">
      {/* Opening and closing time inputs */}
      <View className="flex-row gap-3">
        <TimeInput
          label="Opens"
          value={openTime}
          error={openTimeError}
          onPress={() => onTimePress("openTime")}
        />

        <TimeInput
          label="Closes"
          value={closeTime}
          error={closeTimeError}
          onPress={() => onTimePress("closeTime")}
        />
      </View>

      {/* Overnight schedule indicator */}
      {isOvernight && (
        <View className="w-full flex-row items-center rounded-md border border-text-info/10 bg-info px-3 py-1.5">
          <MaterialCommunityIcons
            name="weather-night"
            size={14}
            color={theme.extends.colors.text.info}
          />

          <Text className="ml-1.5 text-xs font-medium text-text-info">
            Closes the following day
          </Text>
        </View>
      )}

      {/* Native time picker */}
      {timePicker && (
        <TimePicker
          field={timePicker.field}
          time={timePicker.field === "openTime" ? openTime : closeTime}
          onChange={onTimeChange}
        />
      )}
    </View>
  );
}
