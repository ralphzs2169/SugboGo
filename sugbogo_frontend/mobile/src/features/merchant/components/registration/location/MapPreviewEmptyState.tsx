import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { theme } from "@/constants/theme";

/**
 * Overlay displayed when no business location has
 * been selected yet in the preview map.
 */
export default function MapPreviewEmptyState() {
  return (
    <>
      <View pointerEvents="none" className="absolute inset-0 bg-black/35" />

      <View
        pointerEvents="none"
        className="absolute inset-0 items-center justify-center px-6"
      >
        <View className="items-center rounded-xl bg-white/95 px-5 py-4 shadow-md">
          <MaterialCommunityIcons
            name="map-marker-plus-outline"
            size={26}
            color={theme.extends.colors.brand}
          />

          <Text className="mt-1 text-center text-base font-semibold text-text-primary">
            Select your business location
          </Text>

          <Text className="mt-0.5 text-center text-sm text-text-secondary">
            Tap to search or choose on the map
          </Text>
        </View>
      </View>
    </>
  );
}
