import { useState } from "react";
import { Text, View } from "react-native";
import { useFormContext, useFormState, useWatch } from "react-hook-form";

import type { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";
import DaySectionCard from "../operating-hours/DaySectionCard";
import OperatingHoursEditor from "../operating-hours/OperatingHoursEditor";
import {
  DAYS,
  type Day,
} from "@/features/merchant/constants/operatingHours.constants";

/**
 * Renders the operating-hours step of merchant registration.
 *
 * Displays each day as an expandable section and allows merchants
 * to configure the schedule for individual days.
 *
 * Validation errors are shown on collapsed days and remain visible
 * inside the editor when a day is expanded.
 */
export default function OperatingHoursStep() {
  const { control } = useFormContext<MerchantRegistrationForm>();

  const { errors } = useFormState({
    control,
  });

  const operatingHours = useWatch({
    control,
    name: "operatingHours",
  });

  const [expandedDay, setExpandedDay] = useState<Day | null>(null);

  /**
   * Toggles the selected day's editor.
   * Opens the day when collapsed and closes it when already expanded.
   */
  const handleDayPress = (day: Day) => {
    setExpandedDay((currentDay) => (currentDay === day ? null : day));
  };

  return (
    <View className="bg-surface px-6 py-5">
      <View className="mb-5">
        <Text className="text-2xl font-bold text-text-primary">
          Set Your Operating Hours
        </Text>

        <Text className="mt-1 text-sm text-text-secondary">
          Choose when your business is open to explorers.
        </Text>
      </View>

      <View className="gap-3">
        {DAYS.map((day) => {
          const schedule = operatingHours[day];
          const isExpanded = expandedDay === day;

          const dayErrors = errors.operatingHours?.[day];

          const hasError = Boolean(dayErrors) && !isExpanded;

          return (
            <DaySectionCard
              key={day}
              day={day}
              schedule={schedule}
              isExpanded={isExpanded}
              hasError={hasError}
              onPress={() => handleDayPress(day)}
            >
              <OperatingHoursEditor
                day={day}
                onDone={() => setExpandedDay(null)}
              />
            </DaySectionCard>
          );
        })}
      </View>
    </View>
  );
}
