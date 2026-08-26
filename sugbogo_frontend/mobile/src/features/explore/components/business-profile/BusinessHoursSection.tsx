import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LayoutAnimation, Pressable, Text, View } from "react-native";
import { useState } from "react";

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
  const [isExpanded, setIsExpanded] = useState(false);
  const toggleHours = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded((expanded) => !expanded);
    onViewFullHours?.();
  };

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
        onPress={toggleHours}
        className="mt-3 flex-row items-center self-start cursor-pointer active:opacity-70"
      >
        <Text className="text-sm font-semibold text-brand">
          {isExpanded ? "View less" : "View full hours"}
        </Text>

        <MaterialCommunityIcons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={theme.extends.colors.brand}
        />
      </Pressable>

      {isExpanded && (
        <View className="mt-3 gap-2">
          {operatingHours.map((hours) => (
            <View key={hours.id} className="flex-row justify-between">
              <Text className="capitalize text-sm text-text-secondary">
                {hours.day}
              </Text>
              <Text className="text-sm text-text-primary">
                {!hours.is_open
                  ? "Closed"
                  : hours.is_24_hours
                    ? "Open 24 hours"
                    : `${hours.open_time ?? ""} – ${hours.close_time ?? ""}`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
