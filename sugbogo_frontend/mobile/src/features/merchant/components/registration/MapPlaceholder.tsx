import Button from "@/shared/components/Button";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

type MapPlaceholderProps = {
  onPress?: () => void;
};

export default function MapPlaceholder({ onPress }: MapPlaceholderProps) {
  return (
    <View className="overflow-hidden rounded-2xl border border-border-primary bg-background">
      <View className="h-56 items-center justify-center">
        <MaterialCommunityIcons
          name="map-marker-radius-outline"
          size={48}
          color="#9CA3AF"
        />

        <Text className="mt-3 text-base font-semibold text-text-primary">
          Interactive Map
        </Text>

        <Text className="mt-2 px-8 text-center text-sm leading-5 text-text-secondary">
          You'll be able to pin your business location here.
        </Text>
      </View>

      <View className="border-t border-border-primary p-4">
        <Button title="Select Location" onPress={onPress ?? (() => {})} />
      </View>
    </View>
  );
}
