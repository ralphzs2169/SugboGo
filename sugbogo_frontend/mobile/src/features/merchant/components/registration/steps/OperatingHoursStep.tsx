import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useFormContext } from "react-hook-form";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type Day = (typeof DAYS)[number];

type TimeField = "openTime" | "closeTime";

function timeStringToDate(time: string) {
  const date = new Date();

  if (!time) {
    date.setHours(8, 0, 0, 0);
    return date;
  }

  const [hours, minutes] = time.split(":").map(Number);

  date.setHours(hours, minutes, 0, 0);

  return date;
}

function dateToTimeString(date: Date) {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

function formatTime(time: string) {
  if (!time) {
    return "Select time";
  }

  const [hours, minutes] = time.split(":").map(Number);

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function OperatingHoursStep() {
  const { watch, setValue } = useFormContext<MerchantRegistrationForm>();

  const operatingHours = watch("operatingHours");

  const [expandedDay, setExpandedDay] = useState<Day | null>(null);

  const [timePicker, setTimePicker] = useState<{
    day: Day;
    field: TimeField;
  } | null>(null);

  const handleDayPress = (day: Day) => {
    setTimePicker(null);

    setExpandedDay((currentDay) => (currentDay === day ? null : day));
  };

  const handleOpenStateChange = (day: Day, isOpen: boolean) => {
    setValue(`operatingHours.${day}.isOpen`, isOpen, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (!isOpen) {
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

  const handleTimePress = (day: Day, field: TimeField) => {
    setTimePicker({
      day,
      field,
    });
  };

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

    const { day, field } = timePicker;

    setValue(`operatingHours.${day}.${field}`, dateToTimeString(selectedDate), {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (Platform.OS === "android") {
      setTimePicker(null);
    }
  };

  const handleDone = () => {
    setTimePicker(null);
    setExpandedDay(null);
  };

  return (
    <View className="bg-surface px-6 py-5">
      <View className="mb-5">
        <Text className="text-2xl font-bold text-text-primary">
          Operating Hours
        </Text>

        <Text className="mt-1 text-sm text-text-secondary">
          Let explorers know when your business is open.
        </Text>
      </View>

      <View className="gap-3">
        {DAYS.map((day) => {
          const schedule = operatingHours[day];
          const isExpanded = expandedDay === day;

          return (
            <View
              key={day}
              className="overflow-hidden rounded-xl border border-border-primary"
            >
              <Pressable
                className="flex-row items-center justify-between px-4 py-4"
                onPress={() => handleDayPress(day)}
              >
                <View>
                  <Text className="text-base font-semibold capitalize text-text-primary">
                    {day}
                  </Text>

                  {schedule.isOpen ? (
                    <Text className="mt-1 text-sm text-text-secondary">
                      {formatTime(schedule.openTime)} -{" "}
                      {formatTime(schedule.closeTime)}
                    </Text>
                  ) : (
                    <Text className="mt-1 text-sm text-text-tertiary">
                      Closed
                    </Text>
                  )}
                </View>

                <View className="flex-row items-center gap-2">
                  <View
                    className={
                      schedule.isOpen
                        ? "rounded-full bg-green-100 px-3 py-1"
                        : "rounded-full bg-border/40 px-3 py-1"
                    }
                  >
                    <Text
                      className={
                        schedule.isOpen
                          ? "text-xs font-semibold text-green-700"
                          : "text-xs font-semibold text-text-secondary"
                      }
                    >
                      {schedule.isOpen ? "Open" : "Closed"}
                    </Text>
                  </View>

                  <MaterialCommunityIcons
                    name={isExpanded ? "chevron-up" : "chevron-right"}
                    size={20}
                    color="#999999"
                  />
                </View>
              </Pressable>

              {isExpanded && (
                <View className="border-t border-border-primary px-4 py-4">
                  <Text className="mb-3 text-sm font-semibold text-text-primary">
                    Edit {day}
                  </Text>

                  <View className="flex-row gap-3">
                    <Pressable
                      className={
                        schedule.isOpen
                          ? "flex-1 rounded-lg border border-primary bg-primary px-4 py-3"
                          : "flex-1 rounded-lg border border-border-primary px-4 py-3"
                      }
                      onPress={() => handleOpenStateChange(day, true)}
                    >
                      <Text
                        className={
                          schedule.isOpen
                            ? "text-center text-sm font-semibold text-white"
                            : "text-center text-sm font-semibold text-text-secondary"
                        }
                      >
                        Open
                      </Text>
                    </Pressable>

                    <Pressable
                      className={
                        !schedule.isOpen
                          ? "flex-1 rounded-lg border border-primary bg-primary px-4 py-3"
                          : "flex-1 rounded-lg border border-border-primary px-4 py-3"
                      }
                      onPress={() => handleOpenStateChange(day, false)}
                    >
                      <Text
                        className={
                          !schedule.isOpen
                            ? "text-center text-sm font-semibold text-white"
                            : "text-center text-sm font-semibold text-text-secondary"
                        }
                      >
                        Closed
                      </Text>
                    </Pressable>
                  </View>

                  {schedule.isOpen && (
                    <View className="mt-4 gap-3">
                      <View>
                        <Text className="mb-2 text-sm font-medium text-text-primary">
                          Opening time
                        </Text>

                        <Pressable
                          className="flex-row items-center justify-between rounded-lg border border-border-primary px-4 py-3"
                          onPress={() => handleTimePress(day, "openTime")}
                        >
                          <Text className="text-base text-text-primary">
                            {formatTime(schedule.openTime)}
                          </Text>

                          <MaterialCommunityIcons
                            name="clock-outline"
                            size={20}
                            color="#999999"
                          />
                        </Pressable>
                      </View>

                      <View>
                        <Text className="mb-2 text-sm font-medium text-text-primary">
                          Closing time
                        </Text>

                        <Pressable
                          className="flex-row items-center justify-between rounded-lg border border-border-primary px-4 py-3"
                          onPress={() => handleTimePress(day, "closeTime")}
                        >
                          <Text className="text-base text-text-primary">
                            {formatTime(schedule.closeTime)}
                          </Text>

                          <MaterialCommunityIcons
                            name="clock-outline"
                            size={20}
                            color="#999999"
                          />
                        </Pressable>
                      </View>

                      {timePicker?.day === day && (
                        <View className="mt-1">
                          <DateTimePicker
                            value={timeStringToDate(schedule[timePicker.field])}
                            mode="time"
                            is24Hour={false}
                            display={
                              Platform.OS === "ios" ? "spinner" : "default"
                            }
                            onChange={handleTimeChange}
                          />
                        </View>
                      )}
                    </View>
                  )}

                  <Pressable
                    className="mt-4 rounded-lg bg-primary px-4 py-3"
                    onPress={handleDone}
                  >
                    <Text className="text-center text-sm font-semibold text-white">
                      Done
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
