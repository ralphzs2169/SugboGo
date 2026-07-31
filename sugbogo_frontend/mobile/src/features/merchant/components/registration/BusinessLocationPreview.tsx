import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

type BusinessLocationPreviewProps = {
  latitude: number | null;
  longitude: number | null;
  address?: string;
  onPress: () => void;
};

/**
 * Displays a compact preview of the selected business location.
 *
 * Shows whether a location has been selected and displays the
 * associated address when available. Tapping the preview opens
 * the business location picker so the user can select or change
 * their location.
 */
export default function BusinessLocationPreview({
  latitude,
  longitude,
  address,
  onPress,
}: BusinessLocationPreviewProps) {
  const hasLocation = latitude !== null && longitude !== null;

  return (
    <Pressable
      onPress={onPress}
      className="overflow-hidden rounded-2xl border border-border bg-white"
    >
      <View className="h-40 items-center justify-center bg-gray-100">
        <MaterialCommunityIcons
          name="map-marker-radius"
          size={42}
          color="#1B4D3E"
        />

        <Text className="mt-2 text-sm text-gray-500">
          {hasLocation ? "Location selected" : "Select your business location"}
        </Text>
      </View>

      <View className="flex-row items-center px-4 py-4">
        <MaterialCommunityIcons name="map-marker" size={22} color="#F27F0D" />

        <View className="ml-3 flex-1">
          <Text className="text-sm font-semibold text-text-primary">
            {address || "No location selected"}
          </Text>

          <Text className="mt-1 text-xs text-text-secondary">
            {hasLocation
              ? "Tap to change location"
              : "Tap to select a location"}
          </Text>
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color="#6B7280"
        />
      </View>
    </Pressable>
  );
}
