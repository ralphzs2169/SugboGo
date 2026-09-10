import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable } from "react-native";

import AppText from "@/shared/components/AppText";

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

      <AppText weight="semibold" className="ml-2 text-sm text-white">
        Get Directions
      </AppText>
    </Pressable>
  );
}
