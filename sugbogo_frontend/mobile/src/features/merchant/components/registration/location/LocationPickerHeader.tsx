import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import LocationSearch from "./LocationSearch";

type LocationPickerHeaderProps = {
  value: string;
  onChangeText: (text: string) => void;
  onPlaceSelect: Parameters<typeof LocationSearch>[0]["onPlaceSelect"];
  onSuggestionsVisibleChange: (visible: boolean) => void;
  onClose: () => void;
};

/**
 * Header displayed above the full-screen business location picker.
 *
 * Provides navigation together with place search for selecting
 * the business location.
 */
export default function LocationPickerHeader({
  value,
  onChangeText,
  onPlaceSelect,
  onSuggestionsVisibleChange,
  onClose,
}: LocationPickerHeaderProps) {
  return (
    <SafeAreaView
      edges={["top"]}
      className="absolute left-4 right-4 top-0 z-10"
    >
      <View className="rounded-xl bg-white px-4 py-4  shadow-lg">
        <View className="flex-row items-center">
          <Pressable
            onPress={onClose}
            className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-gray-100"
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={21}
              color="#1B4D3E"
            />
          </Pressable>

          <View className="flex-1">
            <Text className="text-base font-bold text-text-primary">
              Pick Your Business Location
            </Text>

            <Text className="mt-0.5 text-xs text-text-secondary">
              Search for a place or tap the map to drop a pin.
            </Text>
          </View>
        </View>

        <View className="mt-4">
          <LocationSearch
            value={value}
            onChangeText={onChangeText}
            onPlaceSelect={onPlaceSelect}
            onSuggestionsVisibleChange={onSuggestionsVisibleChange}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
