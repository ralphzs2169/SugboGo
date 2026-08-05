import { Pressable, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";

type Props = {
  onPress: () => void;
};

export default function DiscoverNearYouButton ({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className="mx-4 mt-6 flex-row items-center justify-center rounded-md bg-brand px-4 py-4"
    >
      {/* Map icon for the nearby hidden gems action */}
      <MaterialCommunityIcons
        name="map-outline"
        size={22}
        color="#FFFFFF"
      />

      {/* CTA text */}
      <Text className="ml-3 text-sm font-bold tracking-wider text-white">
        DISCOVER HIDDEN GEMS NEAR YOU
      </Text>
    </Pressable>
  );
}