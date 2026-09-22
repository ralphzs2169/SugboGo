import { View } from "react-native";

import AppText from "@/shared/components/AppText";

import type { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";
import { formatTime } from "../../../utils/merchant-application/operatingHours.utils";

type Day = keyof MerchantRegistrationForm["operatingHours"];

type OperatingHoursSummaryProps = {
  schedule: MerchantRegistrationForm["operatingHours"][Day];
};

/**
 * Displays a concise summary of a day's operating schedule.
 *
 * Handles closed, 24-hour, standard, and overnight schedules.
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
    return (
      <AppText className="mt-1 text-sm text-text-tertiary">Closed</AppText>
    );
  }

  if (schedule.is24Hours) {
    return (
      <AppText className="mt-1 text-sm text-text-secondary">
        Open 24 hours
      </AppText>
    );
  }

  return (
    <View className="mt-1">
      {/* Daily operating range */}
      <AppText className="text-sm text-text-secondary">
        {formatTime(schedule.openTime)} - {formatTime(schedule.closeTime)}
      </AppText>

      {/* Overnight schedule context */}
      {isOvernight && (
        <AppText className="mt-0.5 text-xs text-text-tertiary">
          Overnight · closes the following day
        </AppText>
      )}
    </View>
  );
}
