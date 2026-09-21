import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import type { PlaceSuggestion } from "@/shared/types/BusinessLocation.types";

type Props = {
  suggestion: PlaceSuggestion;
  isResolving: boolean;
  disabled: boolean;
  onPress: () => void;
};

/**
 * Displays one selectable Google Places suggestion for a journey origin.
 *
 * Shows localized resolving feedback while preventing conflicting selections
 * when another place is already being resolved.
 */
export default function JourneyOriginSuggestionRow({
  suggestion,
  isResolving,
  disabled,
  onPress,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Select ${suggestion.mainText}`}
      accessibilityState={{
        disabled,
        busy: isResolving,
      }}
      className="min-h-16 cursor-pointer flex-row items-center border-b border-border-primary py-3 active:bg-surface disabled:opacity-60"
    >
      {/* Suggestion identity */}
      <View className="w-6 items-center">
        {isResolving ? (
          <ActivityIndicator size="small" color={theme.extends.colors.brand} />
        ) : (
          <MaterialCommunityIcons
            name="map-marker-outline"
            size={22}
            color={theme.extends.colors.brand}
          />
        )}
      </View>

      {/* Suggestion details */}
      <View className="ml-3 min-w-0 flex-1">
        <AppText
          weight="semibold"
          className="text-text-primary"
          numberOfLines={1}
        >
          {suggestion.mainText}
        </AppText>

        {suggestion.secondaryText ? (
          <AppText
            className="mt-0.5 text-sm text-text-secondary"
            numberOfLines={2}
          >
            {suggestion.secondaryText}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}
