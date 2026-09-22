import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import {
  DAYS,
  type Day,
} from "@/features/merchant/constants/registration/operatingHours.constants";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";

import ApplyDayOption from "./ApplyDayOption";

type ApplyToOtherDaysProps = {
  currentDay: Day;
  onApply: (days: Day[]) => void;
};

/**
 * Allows the current operating schedule to be copied to other days.
 *
 * Keeps day selection local until the merchant confirms the selected days,
 * then passes those days back to the parent schedule editor.
 */
export default function ApplyToOtherDays({
  currentDay,
  onApply,
}: ApplyToOtherDaysProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Day[]>([]);

  const otherDays = DAYS.filter((day) => day !== currentDay);

  function toggleDay(day: Day) {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((selectedDay) => selectedDay !== day)
        : [...current, day],
    );
  }

  return (
    <View>
      {/* Schedule-copy trigger */}
      <Pressable
        onPress={() => setIsExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        className="cursor-pointer flex-row items-center justify-between rounded-md border border-border-primary bg-surface px-4 py-3.5 active:bg-surface-secondary"
      >
        <View className="min-w-0 flex-1 flex-row items-center">
          <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary">
            <MaterialCommunityIcons
              name="content-copy"
              size={16}
              color={theme.extends.colors.text.secondary}
            />
          </View>

          <AppText
            weight="semibold"
            className="ml-3 min-w-0 flex-1 text-sm text-text-primary"
          >
            Apply schedule to other days
          </AppText>

          {selectedDays.length > 0 && (
            <View className="ml-2 min-w-6 items-center justify-center rounded-full bg-brand px-2 py-0.5">
              <AppText weight="bold" className="text-xs text-white">
                {selectedDays.length}
              </AppText>
            </View>
          )}
        </View>

        <MaterialCommunityIcons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.extends.colors.text.secondary}
        />
      </Pressable>

      {/* Day selection panel */}
      {isExpanded && (
        <View className="mt-2 rounded-md border border-border-primary bg-surface p-4">
          <AppText
            weight="semibold"
            className="mb-3 text-xs uppercase tracking-wide text-text-tertiary"
          >
            Apply this schedule to
          </AppText>

          <View className="gap-1">
            {otherDays.map((day) => (
              <ApplyDayOption
                key={day}
                day={day}
                isSelected={selectedDays.includes(day)}
                onPress={() => toggleDay(day)}
              />
            ))}
          </View>

          {/* Apply selection */}
          <Button
            title={
              selectedDays.length > 0
                ? `Apply to ${selectedDays.length} ${
                    selectedDays.length === 1 ? "day" : "days"
                  }`
                : "Select days to continue"
            }
            onPress={() => onApply(selectedDays)}
            disabled={selectedDays.length === 0}
            variant="soft"
            className="mt-4"
            fontClassName="text-sm font-semibold"
            rounded="full"
            icon={
              <MaterialCommunityIcons
                name="calendar-check"
                size={18}
                color={theme.extends.colors.brand}
              />
            }
          />
        </View>
      )}
    </View>
  );
}
