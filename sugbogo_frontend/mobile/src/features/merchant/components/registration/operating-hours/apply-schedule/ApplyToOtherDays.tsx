import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  DAYS,
  type Day,
} from "@/features/merchant/constants/registration/operatingHours.constants";
import ApplyDayOption from "./ApplyDayOption";
import { theme } from "@/constants/theme";
import Button from "@/shared/components/Button";

type ApplyToOtherDaysProps = {
  currentDay: Day;
  onApply: (days: Day[]) => void;
};

/**
 * Allows the user to select one or more other days
 * that should receive the current day's schedule.
 *
 * Selection is managed locally and reported to the parent
 * so the parent can apply the schedule as part of the
 * final "Apply Schedule" action.
 */
export default function ApplyToOtherDays({
  currentDay,
  onApply,
}: ApplyToOtherDaysProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Day[]>([]);

  const otherDays = DAYS.filter((day) => day !== currentDay);

  //Toggles a day in the selected-days list.
  const toggleDay = (day: Day) => {
    setSelectedDays((current) =>
      current.includes(day)
        ? current.filter((selectedDay) => selectedDay !== day)
        : [...current, day],
    );
  };

  return (
    <View>
      <Pressable
        className="flex-row items-center justify-between rounded-md border border-border-primary bg-white px-4 py-3.5"
        onPress={() => setIsExpanded((current) => !current)}
      >
        <View className="flex-row items-center">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <MaterialCommunityIcons
              name="content-copy"
              size={16}
              color={theme.extends.colors.text.secondary}
            />
          </View>

          <Text className="ml-3 text-sm font-semibold text-text-primary">
            Apply schedule to other days
          </Text>

          {selectedDays.length > 0 && (
            <View className="ml-2 rounded-full bg-primary px-2 py-0.5">
              <Text className="text-xs font-bold text-white">
                {selectedDays.length}
              </Text>
            </View>
          )}
        </View>

        <MaterialCommunityIcons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={20}
          color="#9AA0A6"
        />
      </Pressable>

      {isExpanded && (
        <View className="mt-2 rounded-md border border-border-primary bg-white p-4">
          <Text className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            Apply this schedule to
          </Text>

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
