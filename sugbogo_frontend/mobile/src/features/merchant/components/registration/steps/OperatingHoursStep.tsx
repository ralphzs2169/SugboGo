import { View, Text, Pressable } from "react-native";
import { useFormContext } from "react-hook-form";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { MerchantRegistrationForm } from "../../../types/merchantRegistration.types";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export default function OperatingHoursStep() {
  const { watch } = useFormContext<MerchantRegistrationForm>();

  const operatingHours = watch("operatingHours");

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

          return (
            <Pressable
              key={day}
              className="flex-row items-center justify-between rounded-xl border border-border px-4 py-4"
              onPress={() => {
                // open time picker later
              }}
            >
              <View>
                <Text className="text-base font-semibold capitalize text-text-primary">
                  {day}
                </Text>

                {schedule.isOpen ? (
                  <Text className="mt-1 text-sm text-text-secondary">
                    {schedule.openTime} - {schedule.closeTime}
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
                  name="chevron-right"
                  size={20}
                  color="#999999"
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
