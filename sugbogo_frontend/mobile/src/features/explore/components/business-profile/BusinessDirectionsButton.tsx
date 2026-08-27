import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text } from "react-native";

type Props = {
  onPress: () => void;
};

/**
 * Provides the primary action for opening directions to a business.
 */
export default function BusinessDirectionsButton({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className="mt-4 flex-row items-center justify-center rounded-lg bg-brand px-4 py-3 cursor-pointer active:opacity-70"
    >
      <MaterialCommunityIcons name="directions" size={18} color="#FFFFFF" />

      <Text className="ml-2 text-sm font-semibold text-white">
        Get Directions
      </Text>
    </Pressable>
  );
}
