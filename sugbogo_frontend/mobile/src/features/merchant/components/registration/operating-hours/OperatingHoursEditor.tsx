import { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Platform, View } from "react-native";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import Toast from "react-native-toast-message";

import AppText from "@/shared/components/AppText";

import type { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";
import { dateToTimeString } from "../../../utils/merchant-application/operatingHours.utils";
import ApplyToOtherDays from "./apply-schedule/ApplyToOtherDays";
import OperatingHoursControls from "./OperatingHoursControls";
import TimeFields from "./TimeFields";

type Day = keyof MerchantRegistrationForm["operatingHours"];
type TimeField = "openTime" | "closeTime";

type OperatingHoursEditorProps = {
  day: Day;
  onDone: () => void;
};

/**
 * Configures the operating schedule for a single day.
 *
 * Handles open and closed states, 24-hour schedules, time selection, overnight
 * schedules, and copying the resulting schedule to other days.
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

  const isOvernight =
    schedule.isOpen &&
    !schedule.is24Hours &&
    Boolean(schedule.openTime) &&
    Boolean(schedule.closeTime) &&
    schedule.closeTime < schedule.openTime;

  function handleOpenStateChange(isOpen: boolean) {
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
  }

  function handle24HoursChange(is24Hours: boolean) {
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
  }

  async function handleApplyToDays(days: Day[]) {
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
  }

  function handleTimePress(field: TimeField) {
    setTimePicker({ field });
  }

  function handleTimeChange(event: DateTimePickerEvent, selectedDate?: Date) {
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
  }

  return (
    <View className="gap-5 border-y border-border-primary bg-surface px-5 py-5">
      {/* Daily schedule heading */}
      <View>
        <AppText weight="bold" className="text-lg capitalize text-text-primary">
          {day}
        </AppText>

        <AppText className="mt-0.5 text-xs text-text-tertiary">
          Set the hours explorers can visit
        </AppText>
      </View>

      {/* Schedule controls */}
      <OperatingHoursControls
        isOpen={schedule.isOpen}
        is24Hours={schedule.is24Hours}
        onOpenStateChange={handleOpenStateChange}
        on24HoursChange={handle24HoursChange}
      />

      {/* Opening and closing times */}
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

      {/* Schedule reuse */}
      <ApplyToOtherDays currentDay={day} onApply={handleApplyToDays} />
    </View>
  );
}
