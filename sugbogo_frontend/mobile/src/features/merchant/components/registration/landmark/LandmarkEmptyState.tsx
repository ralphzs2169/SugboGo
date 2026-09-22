import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

/**
 * Displays the empty state when no landmarks are currently selected.
 */
export default function LandmarksEmptyState() {
  return (
    <View className="items-center rounded-xl border border-dashed border-border-primary px-4 py-6">
      {/* Empty landmark state */}
      <MaterialCommunityIcons
        name="map-marker-off-outline"
        size={28}
        color={theme.extends.colors.text.tertiary}
      />

      <AppText className="mt-2 text-sm text-text-secondary">
        No landmarks selected.
      </AppText>
    </View>
  );
}
