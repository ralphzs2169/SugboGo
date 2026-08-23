import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { theme } from "@/constants/theme";

import type { ExploreBusinessLocation } from "../../types/exploreBusiness.types";

type Props = {
  location: ExploreBusinessLocation;
  onGetDirections?: () => void;
};

/**
 * Displays the business location and provides an action to navigate there.
 *
 * The profile intentionally avoids embedding a map. Explorers can use the
 * location summary to understand where the business is and open navigation
 * when they are ready to travel there.
 */
export default function BusinessLocationSection({
  location,
  onGetDirections,
}: Props) {
  const address = location.address?.trim();
  const cityLine = [location.city, location.province]
    .filter(Boolean)
    .join(", ");

  return (
    <View className="mt-6 border-t border-border-primary px-4 pt-5">
      {/* Section heading */}
      <Text className="text-lg font-bold text-text-primary">Location</Text>

      {/* Location details */}
      <View className="mt-3 flex-row">
        <MaterialCommunityIcons
          name="map-marker-outline"
          size={21}
          color={theme.extends.colors.brand}
        />

        <View className="ml-2 flex-1">
          {address && (
            <Text
              className="text-sm font-medium leading-5 text-text-primary"
              numberOfLines={2}
            >
              {address}
            </Text>
          )}

          {cityLine && (
            <Text className="mt-0.5 text-sm leading-5 text-text-secondary">
              {cityLine}
            </Text>
          )}
        </View>
      </View>

      {/* Navigation action */}
      <Pressable
        onPress={onGetDirections}
        disabled={!onGetDirections}
        className="mt-4 h-12 flex-row items-center justify-center rounded-card border border-border-primary bg-surface active:opacity-80"
      >
        <MaterialCommunityIcons
          name="navigation-variant-outline"
          size={19}
          color={theme.extends.colors.brand}
        />

        <Text className="ml-2 text-sm font-semibold text-brand">
          How to get there
        </Text>
      </Pressable>
    </View>
  );
}
