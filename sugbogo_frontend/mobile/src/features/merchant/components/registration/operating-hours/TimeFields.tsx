import { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import TimeInput from "./time-input/TimeInput";
import TimePicker from "./time-input/TimePicker";

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
 * Displays the opening and closing controls for a normal daily schedule.
 *
 * Includes time validation feedback, overnight context, and the native time
 * picker while a time field is being edited.
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
        <View className="w-full flex-row items-center rounded-md  bg-info px-3 py-1.5">
          <MaterialCommunityIcons
            name="weather-night"
            size={14}
            color={theme.extends.colors.text.info}
          />

          <AppText weight="medium" className="ml-1.5 text-xs text-text-info">
            Closes the following day
          </AppText>
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
