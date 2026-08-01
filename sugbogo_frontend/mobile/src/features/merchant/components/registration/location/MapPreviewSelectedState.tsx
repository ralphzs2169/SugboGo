import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

/**
 * Overlay displayed when a business location has
 * already been selected in the preview map.
 */
export default function MapPreviewSelectedState() {
  return (
    <View className="absolute inset-x-0 bottom-0 flex-row items-center justify-between bg-black/55 px-4 py-3">
      <View className="flex-row items-center gap-2">
        <MaterialCommunityIcons
          name="map-marker-check"
          size={18}
          color="#4ADE80"
        />

        <Text className="text-[13px] font-semibold text-white">
          Location pinned
        </Text>
      </View>

      <Text className="text-[13px] font-medium text-white/80">Change</Text>
    </View>
  );
}
