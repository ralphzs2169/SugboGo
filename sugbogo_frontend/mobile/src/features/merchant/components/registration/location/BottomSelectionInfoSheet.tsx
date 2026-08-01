import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";

/**
 * Bottom sheet shown before a business location has been selected.
 *
 * Instructs the merchant to search for a place or tap directly
 * on the map to choose their business location.
 */
export default function BottomSelectionInfoSheet() {
  return (
    <View className="absolute bottom-0 left-0 right-0">
      <SafeAreaView edges={["bottom"]}>
        <View className="rounded-t-3xl bg-white px-4 py-4 shadow-lg">
          <View className="flex-row items-center">
            <MaterialCommunityIcons
              name="map-search-outline"
              size={24}
              color={theme.extends.colors.brand}
            />

            <View className="ml-3 flex-1">
              <Text className="text-base font-bold text-text-primary">
                Choose your business location
              </Text>

              <Text className="mt-1 text-sm text-text-secondary">
                Search for a place above or tap the map to drop a pin.
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
