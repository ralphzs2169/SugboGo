import { theme } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

/**
 * State displayed when address details could not be loaded.
 */
export default function AddressLoadFailedState() {
  return (
    <View className="mb-4 flex-row items-start gap-3 rounded-xl bg-orange-50 px-4 py-3">
      <MaterialCommunityIcons
        name="map-marker-alert-outline"
        size={22}
        color={theme.extends.colors.brand}
      />

      <View className="flex-1">
        <Text className="text-sm font-semibold text-text-primary">
          Address details unavailable
        </Text>

        <Text className="mt-1 text-xs leading-5 text-text-secondary">
          Something went wrong. Try pinning your location again to load the
          required address details.
        </Text>
      </View>
    </View>
  );
}
