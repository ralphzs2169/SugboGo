import { useState } from "react";
import { Platform, Text, View } from "react-native";
import { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useFormContext, useWatch } from "react-hook-form";
import ApplyToOtherDays from "./apply-schedule/ApplyToOtherDays";
import TimeFields from "./TimeFields";
import type { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";
import { dateToTimeString } from "../../../utils/operatingHours.utils";
import Toast from "react-native-toast-message";
import OperatingHoursControls from "./OperatingHoursControls";

type Day = keyof MerchantRegistrationForm["operatingHours"];

type TimeField = "openTime" | "closeTime";

type OperatingHoursEditorProps = {
  day: Day;
  onDone: () => void;
};

/**
 * Editor for configuring a single day's operating schedule.
 *
 * Handles:
 * - Open/closed state
 * - 24-hour schedules
 * - Opening and closing times
 * - Overnight schedule detection
 * - Applying the schedule to other days
 * - Closing the editor when editing is complete
 */
export default function OperatingHoursEditor({
  day,
  onDone,
}: OperatingHoursEditorProps) {
  const {
    control,
    setValue,
    trigger,
    getValues,
    formState: { errors },
  } = useFormContext<MerchantRegistrationForm>();

  const schedule = useWatch({
    control,
    name: `operatingHours.${day}`,
  });

  const dayErrors = errors.operatingHours?.[day];

  const [timePicker, setTimePicker] = useState<{
    field: TimeField;
  } | null>(null);

  // A closing time earlier than the opening time means the schedule
  // continues into the following day.
  const isOvernight =
    schedule.isOpen &&
    !schedule.is24Hours &&
    Boolean(schedule.openTime) &&
    Boolean(schedule.closeTime) &&
    schedule.closeTime < schedule.openTime;

  /**
   * Updates whether the selected day is open.
   * When the day is closed, its 24-hour state and time values
   * are reset because they are no longer applicable.
   */
  const handleOpenStateChange = (isOpen: boolean) => {
    setValue(`operatingHours.${day}.isOpen`, isOpen, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (!isOpen) {
      setTimePicker(null);

      setValue(`operatingHours.${day}.is24Hours`, false, {
        shouldDirty: true,
        shouldValidate: true,
      });

      setValue(`operatingHours.${day}.openTime`, "", {
        shouldDirty: true,
        shouldValidate: true,
      });

      setValue(`operatingHours.${day}.closeTime`, "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  /**
   * Toggles the selected day between a normal schedule and
   * a 24-hour schedule.
   *
   * When 24-hour mode is enabled, opening and closing times
   * are cleared because they are no longer applicable.
   */
  const handle24HoursChange = (is24Hours: boolean) => {
    setValue(`operatingHours.${day}.is24Hours`, is24Hours, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (is24Hours) {
      setTimePicker(null);

      setValue(`operatingHours.${day}.openTime`, "", {
        shouldDirty: true,
        shouldValidate: true,
      });

      setValue(`operatingHours.${day}.closeTime`, "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  /**
   * Validates the current day's schedule and applies it to
   * the selected days when valid.
   *
   * Invalid schedules are not copied to other days.
   */
  const handleApplyToDays = async (days: Day[]) => {
    const isValid = await trigger(`operatingHours.${day}`);

    if (!isValid) {
      return;
    }

    const currentSchedule = getValues(`operatingHours.${day}`);

    days.forEach((targetDay) => {
      setValue(
        `operatingHours.${targetDay}`,
        { ...currentSchedule },
        {
          shouldDirty: true,
          shouldValidate: true,
        },
      );
    });

    Toast.show({
      type: "success",
      text1: "Schedule applied",
      text2: `The same hours were applied to ${days.length} ${
        days.length === 1 ? "day" : "days"
      }.`,
    });

    setTimePicker(null);
    onDone();
  };

  // Opens the time picker for the specified time field.
  const handleTimePress = (field: TimeField) => {
    setTimePicker({ field });
  };

  /**
   * Updates the selected time field from the native time picker.
   *
   * The picker is closed immediately on Android because the
   * Android time picker is a modal interaction.
   */
  const handleTimeChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (event.type === "dismissed") {
      setTimePicker(null);
      return;
    }

    if (!selectedDate || !timePicker) {
      return;
    }

    setValue(
      `operatingHours.${day}.${timePicker.field}`,
      dateToTimeString(selectedDate),
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );

    if (Platform.OS === "android") {
      setTimePicker(null);
    }
  };

  return (
    <View className="gap-5 px-2 rounded-b-md  border-y border-border-primary bg-white px-5 py-5 ">
      <View>
        <Text className="text-lg font-bold capitalize text-text-primary">
          {day}
        </Text>
        <Text className="mt-0.5 text-xs text-text-tertiary">
          Set the hours explorers can visit
        </Text>
      </View>

      <OperatingHoursControls
        isOpen={schedule.isOpen}
        is24Hours={schedule.is24Hours}
        onOpenStateChange={handleOpenStateChange}
        on24HoursChange={handle24HoursChange}
      />

      {schedule.isOpen && !schedule.is24Hours && (
        <TimeFields
          openTime={schedule.openTime}
          closeTime={schedule.closeTime}
          isOvernight={isOvernight}
          timePicker={timePicker}
          onTimePress={handleTimePress}
          onTimeChange={handleTimeChange}
          openTimeError={dayErrors?.openTime?.message}
          closeTimeError={dayErrors?.closeTime?.message}
        />
      )}

      <ApplyToOtherDays currentDay={day} onApply={handleApplyToDays} />
    </View>
  );
}
