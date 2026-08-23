import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { theme } from "@/constants/theme";

import type { ExploreOperatingHours } from "../../types/exploreBusiness.types";
import { getBusinessHoursSummary } from "../../utils/businessHours.utils";

type Props = {
  operatingHours: ExploreOperatingHours[];
  onViewFullHours?: () => void;
};

/**
 * Displays a concise, context-aware summary of the business's operating
 * status and provides access to the complete weekly schedule.
 */
export default function BusinessHoursSection({
  operatingHours,
  onViewFullHours,
}: Props) {
  const summary = getBusinessHoursSummary(operatingHours);

  return (
    <View className="mt-6 border-t border-border-primary px-4 pt-5">
      {/* Current operating status */}
      <View className="flex-row items-center">
        <MaterialCommunityIcons
          name="clock-outline"
          size={20}
          color={theme.extends.colors.text.secondary}
        />

        <Text
          className={`ml-2 flex-1 text-sm font-semibold ${
            summary.isOpen ? "text-success" : "text-text-primary"
          }`}
        >
          {summary.label}
        </Text>
      </View>

      {/* Full schedule action */}
      <Pressable
        onPress={onViewFullHours}
        disabled={!onViewFullHours}
        className="mt-3 flex-row items-center self-start active:opacity-70"
      >
        <Text className="text-sm font-semibold text-brand">
          View full hours
        </Text>

        <MaterialCommunityIcons
          name="chevron-down"
          size={18}
          color={theme.extends.colors.brand}
        />
      </Pressable>
    </View>
  );
}
