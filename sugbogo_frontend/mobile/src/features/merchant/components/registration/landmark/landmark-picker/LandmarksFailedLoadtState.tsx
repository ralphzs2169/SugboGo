import { theme } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

/**
 * State displayed when nearby landmarks could not be loaded.
 */
export default function LandmarksLoadFailedState() {
  return (
    <View className="items-center rounded-xl border border-dashed border-gray-300 px-4 py-6">
      <MaterialCommunityIcons
        name="map-marker-alert-outline"
        size={28}
        color={theme.extends.colors.text.secondary}
      />

      <Text className="mt-2 text-sm font-medium text-text-secondary">
        Couldn't load nearby landmarks
      </Text>

      <Text className="mt-1 text-center text-xs text-text-secondary">
        Something went wrong. You can add your own landmark instead.
      </Text>
    </View>
  );
}
