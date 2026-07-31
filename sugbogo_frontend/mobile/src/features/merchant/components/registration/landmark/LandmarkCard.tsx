import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { BusinessLandmark } from "@/shared/types/BusinessLocation.types";
import { theme } from "@/constants/theme";

type LandmarkCardProps = {
  landmark: BusinessLandmark;
  onRemove: (id: string) => void;
};

const ICON_SIZE = 20;

/**
 * Displays a selected landmark with an action to remove it.
 */
export default function LandmarkCard({
  landmark,
  onRemove,
}: LandmarkCardProps) {
  return (
    <View className="flex-row items-center rounded-xl border border-gray-200 bg-white px-4 py-3">
      <MaterialCommunityIcons
        name={landmark.source === "custom" ? "map-marker-plus" : "map-marker"}
        size={22}
      />

      <View className="ml-3 flex-1">
        <Text className="text-sm font-semibold text-text-primary">
          {landmark.name}
        </Text>

        {!!landmark.address && (
          <Text
            numberOfLines={1}
            className="mt-0.5 text-xs text-text-secondary"
          >
            {landmark.address}
          </Text>
        )}
      </View>

      <Pressable onPress={() => onRemove(landmark.id)} className="p-2">
        <MaterialCommunityIcons
          name="close"
          size={ICON_SIZE}
          color={theme.extends.colors.error}
        />
      </Pressable>
    </View>
  );
}
