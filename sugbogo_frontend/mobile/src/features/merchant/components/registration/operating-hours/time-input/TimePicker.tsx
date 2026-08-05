import { Platform } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { timeStringToDate } from "@/features/merchant/utils/merchant-application/operatingHours.utils";

type TimeField = "openTime" | "closeTime";

type TimePickerProps = {
  field: TimeField;
  time: string;
  onChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
};

/**
 * Displays the native time picker for an operating-hours time field.
 *
 * The picker is rendered without an additional container so that
 * Android can present its native picker without a visible transition
 * artifact.
 */
export default function TimePicker({ field, time, onChange }: TimePickerProps) {
  return (
    <DateTimePicker
      value={timeStringToDate(time)}
      mode="time"
      is24Hour={false}
      display={Platform.OS === "ios" ? "spinner" : "default"}
      onChange={onChange}
    />
  );
}
