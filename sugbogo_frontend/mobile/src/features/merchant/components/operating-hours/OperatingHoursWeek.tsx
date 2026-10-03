import { useState } from "react";
import { LayoutChangeEvent, View } from "react-native";
import { useFormContext, useFormState, useWatch } from "react-hook-form";

import AppText from "@/shared/components/AppText";
import { DAYS, type Day } from "../../constants/operatingHours.constants";
import type { OperatingHoursForm } from "../../validation/operatingHours.schema";
import DaySectionCard from "./DaySectionCard";
import OperatingHoursEditor from "./OperatingHoursEditor";

type DayTarget = {
  ref: (node: View | null) => void;
  onLayout: (event: LayoutChangeEvent) => void;
};

type OperatingHoursWeekProps = {
  registerDayTarget?: (day: Day) => DayTarget;
  showScheduleError?: boolean;
};

/** Render the same editable seven-day schedule for registration and management. */
export default function OperatingHoursWeek({
  registerDayTarget,
  showScheduleError = false,
}: OperatingHoursWeekProps) {
  const { control } = useFormContext<OperatingHoursForm>();
  const { errors } = useFormState({ control });
  const operatingHours = useWatch({ control, name: "operatingHours" });
  const [expandedDay, setExpandedDay] = useState<Day | null>(null);

  return (
    <View className="gap-3">
      {showScheduleError && errors.operatingHours?.message && (
        <AppText className="text-sm text-text-error">
          {errors.operatingHours.message}
        </AppText>
      )}

      {DAYS.map((day) => {
        const schedule = operatingHours[day];
        const isExpanded = expandedDay === day;
        const hasError = Boolean(errors.operatingHours?.[day]) && !isExpanded;

        return (
          <View key={day} {...registerDayTarget?.(day)}>
            <DaySectionCard
              day={day}
              schedule={schedule}
              isExpanded={isExpanded}
              hasError={hasError}
              onPress={() => {
                setExpandedDay((current) => (current === day ? null : day));
              }}
            >
              <OperatingHoursEditor
                day={day}
                onDone={() => setExpandedDay(null)}
              />
            </DaySectionCard>
          </View>
        );
      })}
    </View>
  );
}
