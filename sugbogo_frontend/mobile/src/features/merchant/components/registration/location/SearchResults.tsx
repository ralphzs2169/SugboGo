import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { theme } from "@/constants/theme";

const MAX_SUGGESTIONS_HEIGHT = 260;

type PlaceSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText?: string;
};

type SearchResultsProps = {
  suggestions: PlaceSuggestion[];
  showNoResults: boolean;
  resolvingPlaceId: string | null;
  onPlaceSelect: (placeId: string) => void;
  isRateLimited: boolean;
};

/**
 * Displays Google Places search suggestions beneath
 * the business location search field.
 *
 * Matching places are shown while the user searches.
 * If no results are found, an empty state is displayed
 * instead.
 */
export default function SearchResults({
  suggestions,
  showNoResults,
  resolvingPlaceId,
  onPlaceSelect,
  isRateLimited,
}: SearchResultsProps) {
  if (!isRateLimited && !showNoResults && suggestions.length === 0) {
    return null;
  }

  return (
    <View
      className="absolute left-0 right-0 top-[58px] overflow-hidden rounded-xl bg-white shadow-md"
      style={{ maxHeight: MAX_SUGGESTIONS_HEIGHT }}
    >
      {isRateLimited ? (
        <View className="items-center px-4 py-5">
          <MaterialCommunityIcons name="timer-sand" size={20} color="#9CA3AF" />

          <Text className="mt-1.5 text-center text-sm text-gray-500">
            You're searching too quickly.
          </Text>

          <Text className="mt-0.5 text-center text-xs text-gray-400">
            Please wait a moment and try again.
          </Text>
        </View>
      ) : showNoResults ? (
        <View className="items-center px-4 py-5">
          <MaterialCommunityIcons
            name="map-marker-off-outline"
            size={20}
            color="#9CA3AF"
          />

          <Text className="mt-1.5 text-sm text-gray-500">
            No matching places found
          </Text>
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
          {suggestions.map((suggestion, index) => {
            // Only the suggestion currently being resolved
            // displays a loading indicator.
            const isResolving = resolvingPlaceId === suggestion.placeId;

            return (
              <Pressable
                key={suggestion.placeId}
                onPress={() => onPlaceSelect(suggestion.placeId)}
                disabled={resolvingPlaceId !== null}
                className={`flex-row items-center px-4 py-3 active:bg-gray-50 ${
                  index < suggestions.length - 1
                    ? "border-b border-gray-100"
                    : ""
                }`}
              >
                {isResolving ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.extends.colors.brand}
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="map-marker-outline"
                    size={20}
                    color="#1B4D3E"
                  />
                )}

                <View className="ml-3 flex-1">
                  <Text className="text-[15px] font-semibold text-gray-800">
                    {suggestion.mainText}
                  </Text>

                  {suggestion.secondaryText && (
                    <Text className="mt-0.5 text-[13px] text-gray-500">
                      {suggestion.secondaryText}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
