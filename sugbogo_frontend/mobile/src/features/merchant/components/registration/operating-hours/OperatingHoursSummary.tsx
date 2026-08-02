import { Text, View } from "react-native";

import type { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";
import { formatTime } from "../../../utils/operatingHours.utils";

type Day = keyof MerchantRegistrationForm["operatingHours"];

type OperatingHoursSummaryProps = {
  schedule: MerchantRegistrationForm["operatingHours"][Day];
};

/**
 * Displays a concise summary of a day's operating schedule.
 *
 * Handles closed, 24-hour, normal, and overnight schedules.
 */
export default function OperatingHoursSummary({
  schedule,
}: OperatingHoursSummaryProps) {
  const isOvernight =
    schedule.isOpen &&
    !schedule.is24Hours &&
    Boolean(schedule.openTime) &&
    Boolean(schedule.closeTime) &&
    schedule.closeTime < schedule.openTime;

  if (!schedule.isOpen) {
    return <Text className="mt-1 text-sm text-text-tertiary">Closed</Text>;
  }

  if (schedule.is24Hours) {
    return (
      <Text className="mt-1 text-sm text-text-secondary">Open 24 hours</Text>
    );
  }

  return (
    <View className="mt-1">
      <Text className="text-sm text-text-secondary">
        {formatTime(schedule.openTime)} - {formatTime(schedule.closeTime)}
      </Text>

      {isOvernight && (
        <Text className="mt-0.5 text-xs text-text-tertiary">
          Overnight · closes the following day
        </Text>
      )}
    </View>
  );
}
