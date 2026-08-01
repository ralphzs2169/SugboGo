import { View } from "react-native";
import { useState, useEffect } from "react";

import SearchBar from "./SearchBar";
import SearchResults from "./SearchResults";
import usePlaceSearch from "../../../hooks/registration/usePlaceSearch";
import { BusinessLocation } from "@/shared/types/BusinessLocation.types";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onPlaceSelect: (location: BusinessLocation) => void;

  // Tells the parent whether the suggestions dropdown is currently showing,
  // so it can disable map taps while a suggestion is on top of it.
  onSuggestionsVisibleChange?: (visible: boolean) => void;
};

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
  onSuggestionsVisibleChange,
}: Props) {
  const {
    suggestions,
    isLoading,
    isSearchRateLimited,
    searchPlaces,
    getPlaceDetails,
    clearSuggestions,
  } = usePlaceSearch();

  const [resolvingPlaceId, setResolvingPlaceId] = useState<string | null>(null);

  // Only search once the user has entered enough characters
  // to produce meaningful place suggestions.
  const hasQuery = value.trim().length >= 2;

  const showNoResults =
    hasQuery &&
    !isLoading &&
    !isSearchRateLimited &&
    suggestions.length === 0 &&
    !resolvingPlaceId;

  /**
   * Resolves the selected place into a complete business
   * location and updates the search input.
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
   * Clears the current search query and hides any
   * displayed place suggestions.
   */
  function handleClear() {
    onChangeText("");
    clearSuggestions();
  }

  // Notify the parent whenever the suggestion dropdown
  // becomes visible or hidden.
  useEffect(() => {
    onSuggestionsVisibleChange?.(suggestions.length > 0);
  }, [suggestions.length]);

  return (
    <View className="relative z-10 mb-3">
      <SearchBar
        value={value}
        isLoading={isLoading}
        onClear={handleClear}
        onChangeText={(text) => {
          onChangeText(text);
          searchPlaces(text);
        }}
      />

      <SearchResults
        suggestions={suggestions}
        showNoResults={showNoResults}
        isRateLimited={isSearchRateLimited}
        resolvingPlaceId={resolvingPlaceId}
        onPlaceSelect={handlePlaceSelect}
      />
    </View>
  );
}
