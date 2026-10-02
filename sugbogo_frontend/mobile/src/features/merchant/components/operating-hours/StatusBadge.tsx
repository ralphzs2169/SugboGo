import { View } from "react-native";
import AppText from "@/shared/components/AppText";

type OperatingHoursStatusBadgeProps = {
  isOpen: boolean;
};

/**
 * Displays the open or closed status of an operating-hours schedule.
 */
export default function OperatingHoursStatusBadge({
  isOpen,
}: OperatingHoursStatusBadgeProps) {
  return (
    <View className="flex-row items-center">
      <View
        className={
          isOpen
            ? "mr-1.5 h-1.5 w-1.5 rounded-full bg-green-500"
            : "mr-1.5 h-1.5 w-1.5 rounded-full bg-gray-400"
        }
      />

      <AppText
        weight="semibold"
        className={
          isOpen ? "text-xs  text-green-700" : "text-xs text-text-secondary"
        }
      >
        {isOpen ? "Open" : "Closed"}
      </AppText>
    </View>
  );
}
