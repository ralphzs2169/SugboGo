import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

/**
 * Displays the unavailable landmark state before a business location is chosen.
 *
 * Explains that nearby landmark suggestions depend on a confirmed business
 * location.
 */
export default function DisabledSelectionState() {
  return (
    <View className="items-center rounded-xl border border-border-disabled bg-disabled px-4 py-6">
      {/* Disabled landmark state */}
      <MaterialCommunityIcons
        name="map-marker-outline"
        size={28}
        color={theme.extends.colors.text.disabled}
      />

      <AppText weight="medium" className="mt-2 text-sm text-text-tertiary">
        Select a business location first
      </AppText>

      <AppText className="mt-1 text-center text-xs text-text-tertiary">
        Nearby landmarks will appear here after you pin your business.
      </AppText>
    </View>
  );
}
