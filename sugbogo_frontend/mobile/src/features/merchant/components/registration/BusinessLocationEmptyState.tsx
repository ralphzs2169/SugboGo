import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";

/**
 * Displays guidance when no business location has been selected.
 *
 * The message explains that the user can either search for a place
 * or tap directly on the map to select a location.
 */
export default function BusinessLocationEmptyState() {
  return (
    // Keep the guidance above the device's bottom safe area so it
    // remains accessible on devices with gesture/navigation insets.
    <SafeAreaView
      edges={["bottom"]}
      className="absolute bottom-0 left-8 right-8"
    >
      <View className="mb-3 items-center">
        <View
          className="flex-row items-center rounded-xl bg-white px-4 py-3"
          style={{ elevation: 3 }}
        >
          <MaterialCommunityIcons
            name="gesture-tap"
            size={18}
            color={theme.extends.colors.text.primary}
          />

          <Text className="ml-2 flex-1 text-center text-sm text-text-secondary">
            <Text className="font-semibold text-text-primary">Search</Text>
            {" your business or "}
            <Text className="font-semibold text-text-primary">tap the map</Text>
            {" to select a location"}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
