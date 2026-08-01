import { theme } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

/**
 * Placeholder displayed until a business location
 * has been selected.
 */
export default function DisabledSelectionState() {
  return (
    <View className="items-center rounded-xl border border-border-disabled bg-disabled px-4 py-6">
      <MaterialCommunityIcons
        name="map-marker-outline"
        size={28}
        color={theme.extends.colors.text.disabled}
      />

      <Text className="mt-2 text-sm font-medium text-text-tertiary">
        Select a business location first
      </Text>

      <Text className="mt-1 text-center text-xs text-text-tertiary">
        Nearby landmarks will appear here after you pin your business.
      </Text>
    </View>
  );
}
