import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useState } from "react";

import usePlaceSearch from "../../hooks/registration/usePlaceSearch";
import { BusinessLocation } from "@/shared/types/BusinessLocation.types";
import { theme } from "@/constants/theme";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onPlaceSelect: (location: BusinessLocation) => void;
};

const MAX_SUGGESTIONS_HEIGHT = 260;

/**
 * Provides a searchable Google Places input for selecting
 * a business location.
 *
 * Displays place suggestions as the user types, allows the
 * user to select a place, and resolves the selected place
 * into complete location details.
 */
export default function BusinessLocationSearch({
  value,
  onChangeText,
  onPlaceSelect,
}: Props) {
  const {
    suggestions,
    isLoading,
    searchPlaces,
    getPlaceDetails,
    clearSuggestions,
  } = usePlaceSearch();

  const [resolvingPlaceId, setResolvingPlaceId] = useState<string | null>(null);

  // Only search once the user has entered enough characters
  // to produce meaningful place suggestions.
  const hasQuery = value.trim().length >= 2;

  // Show an explicit empty state only after the search has
  // finished and no place is currently being resolved.
  const showNoResults =
    hasQuery && !isLoading && suggestions.length === 0 && !resolvingPlaceId;

  /**
   * Resolves the selected Google Place ID into complete
   * location details and passes the result to the parent.
   *
   * The selected place is temporarily tracked so its
   * corresponding suggestion can display a loading state
   * while its details are being retrieved.
   */
  async function handlePlaceSelect(placeId: string) {
    setResolvingPlaceId(placeId);

    const place = await getPlaceDetails(placeId);

    setResolvingPlaceId(null);

    if (!place) {
      return;
    }

    onPlaceSelect(place);
    onChangeText(place.formattedAddress);
    clearSuggestions();
  }

  /**
   * Clears the current search query and removes any
   * currently displayed place suggestions.
   */
  function handleClear() {
    onChangeText("");
    clearSuggestions();
  }

  return (
    <View className="relative z-10 mb-3">
      <View className="h-[52px] flex-row items-center rounded-md border border-gray-300 bg-white px-4">
        <MaterialCommunityIcons name="magnify" size={22} color="#6B7280" />

        <TextInput
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
            searchPlaces(text);
          }}
          placeholder="Search your business location"
          placeholderTextColor="#9CA3AF"
          returnKeyType="search"
          className="ml-2 flex-1 text-[15px] text-gray-800"
        />

        {isLoading && (
          <ActivityIndicator size="small" color={theme.extends.colors.brand} />
        )}

        {!isLoading && value.length > 0 && (
          <Pressable
            onPress={handleClear}
            hitSlop={8}
            className="ml-1 h-6 w-6 items-center justify-center rounded-full bg-gray-100"
          >
            <MaterialCommunityIcons name="close" size={14} color="#6B7280" />
          </Pressable>
        )}
      </View>

      {(suggestions.length > 0 || showNoResults) && (
        <View
          className="absolute left-0 right-0 top-[58px] overflow-hidden rounded-xl bg-white shadow-md"
          style={{ maxHeight: MAX_SUGGESTIONS_HEIGHT }}
        >
          {showNoResults ? (
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
                // Only the suggestion whose Place Details request is
                // currently running should display a loading indicator.
                const isResolving = resolvingPlaceId === suggestion.placeId;

                return (
                  <Pressable
                    key={suggestion.placeId}
                    onPress={() => handlePlaceSelect(suggestion.placeId)}
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
      )}
    </View>
  );
}
