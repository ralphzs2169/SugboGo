import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import OperatingHoursSummary from "./OperatingHoursSummary";
import type { MerchantRegistrationForm } from "../../../validation/merchantRegistration.schema";
import OperatingHoursStatusBadge from "./StatusBadge";
import { theme } from "@/constants/theme";

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
 * Shows the day name, schedule summary, open/closed status, and expansion
 * control. When expanded, the provided children are rendered as the day's
 * operating-hours editor.
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
    <View
      className={`overflow-hidden rounded-xl border ${
        hasError ? "border-border-error bg-error" : "border-border-primary"
      }`}
    >
      <Pressable
        className="flex-row items-center justify-between px-4 py-4"
        onPress={onPress}
      >
        <View>
          <Text className="text-base font-semibold capitalize text-text-primary">
            {day}
          </Text>

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

      {isExpanded && <View>{children}</View>}
    </View>
  );
}
