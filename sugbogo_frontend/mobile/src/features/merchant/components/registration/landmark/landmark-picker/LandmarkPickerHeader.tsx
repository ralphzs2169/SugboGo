import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

type LandmarkPickerHeaderProps = {
  onClose: () => void;
};

/**
 * Header overlay displayed above the landmark picker map.
 */
export default function LandmarkPickerHeader({
  onClose,
}: LandmarkPickerHeaderProps) {
  return (
    <View className="absolute left-4 right-4 top-12">
      <View className="rounded-2xl bg-white px-4 py-3 shadow-lg">
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
              Add Custom Landmark
            </Text>

            <Text className="mt-0.5 text-xs text-text-secondary">
              Create a landmark near your business.
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
