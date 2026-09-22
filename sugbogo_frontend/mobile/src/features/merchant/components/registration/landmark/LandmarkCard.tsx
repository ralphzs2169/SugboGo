import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import type { BusinessLandmark } from "@/shared/types/BusinessLocation.types";

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
      {/* Landmark identity */}
      <MaterialCommunityIcons
        name={landmark.source === "custom" ? "map-marker-plus" : "map-marker"}
        size={22}
        color={theme.extends.colors.text.secondary}
      />

      <View className="ml-3 min-w-0 flex-1">
        <AppText
          weight="semibold"
          className="text-sm text-text-primary"
          numberOfLines={1}
        >
          {landmark.name}
        </AppText>

        {!!landmark.address && (
          <AppText
            numberOfLines={1}
            className="mt-0.5 text-xs text-text-secondary"
          >
            {landmark.address}
          </AppText>
        )}
      </View>

      {/* Remove action */}
      <Pressable
        onPress={() => onRemove(landmark.id)}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${landmark.name}`}
        className="cursor-pointer p-2 active:opacity-60"
      >
        <MaterialCommunityIcons
          name="close"
          size={ICON_SIZE}
          color={theme.extends.colors.error}
        />
      </Pressable>
    </View>
  );
}
