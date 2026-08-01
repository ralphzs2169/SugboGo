import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

/**
 * Empty state displayed when no landmarks have been selected.
 */
export default function LandmarksEmptyState() {
  return (
    <View className="items-center rounded-xl border border-dashed border-gray-300 px-4 py-6">
      <MaterialCommunityIcons
        name="map-marker-off-outline"
        size={28}
        color="#9CA3AF"
      />

      <Text className="mt-2 text-sm text-text-secondary">
        No landmarks selected.
      </Text>
    </View>
  );
}
