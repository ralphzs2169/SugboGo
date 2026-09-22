import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { shadows } from "@/shared/styles/shadows";

import type { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";
import OperatingHoursSummary from "./OperatingHoursSummary";
import OperatingHoursStatusBadge from "./StatusBadge";

type Day = keyof MerchantRegistrationForm["operatingHours"];

type DaySectionCardProps = {
  day: Day;
  schedule: MerchantRegistrationForm["operatingHours"][Day];
  isExpanded: boolean;
  hasError: boolean;
  onPress: () => void;
  children?: React.ReactNode;
};

/**
 * Displays a merchant's operating hours for a single day.
 *
 * Shows the schedule summary and status while allowing the day's editor to
 * expand within the same card.
 */
export default function DaySectionCard({
  day,
  schedule,
  isExpanded,
  hasError,
  onPress,
  children,
}: DaySectionCardProps) {
  return (
    <View className="rounded-xl bg-surface" style={shadows.subtle}>
      <View
        className={`overflow-hidden rounded-xl border ${
          hasError
            ? "border-border-error bg-error"
            : "border-border-primary bg-surface"
        }`}
      >
        {/* Day summary */}
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          className="cursor-pointer flex-row items-center justify-between px-4 py-4 active:bg-surface-secondary"
        >
          <View className="min-w-0 flex-1 pr-3">
            <AppText
              weight="semibold"
              className="text-base capitalize text-text-primary"
            >
              {day}
            </AppText>

            <OperatingHoursSummary schedule={schedule} />
          </View>

          <View className="flex-row items-center gap-2">
            <OperatingHoursStatusBadge isOpen={schedule.isOpen} />

            <MaterialCommunityIcons
              name={isExpanded ? "chevron-up" : "chevron-right"}
              size={20}
              color={theme.extends.colors.text.secondary}
            />
          </View>
        </Pressable>

        {/* Expanded schedule editor */}
        {isExpanded && <View>{children}</View>}
      </View>
    </View>
  );
}
