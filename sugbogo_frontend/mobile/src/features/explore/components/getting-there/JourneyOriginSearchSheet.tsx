import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";

import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import usePlaceSearch from "@/shared/hooks/usePlaceSearch";
import type {
  GooglePlaceLocation,
  PlaceSuggestion,
} from "@/shared/types/BusinessLocation.types";

import {
  getJourneyOriginPlaceDetails,
  searchJourneyOriginPlaces,
} from "../../api/journeyOrigin.service";

import PlaceSearchFeedback from "@/shared/components/place-search/PlaceSearchFeedback";
import PlaceSuggestionRow from "@/shared/components/place-search/PlaceSuggestionRow";

const JOURNEY_ORIGIN_PLACE_API = {
  searchPlaces: searchJourneyOriginPlaces,
  getPlaceDetails: getJourneyOriginPlaceDetails,
};

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  onPlaceSelect: (latitude: number, longitude: number, label: string) => void;
};

/**
 * Provides a keyboard-friendly place search for selecting a journey origin.
 *
 */
export default function JourneyOriginSearchSheet({
  sheetRef,
  onPlaceSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const [resolvingPlaceId, setResolvingPlaceId] = useState<string | null>(null);

  const {
    suggestions,
    isLoading,
    error,
    isSearchRateLimited,
    searchPlaces,
    getPlaceDetails,
    clearSuggestions,
  } = usePlaceSearch<GooglePlaceLocation>(JOURNEY_ORIGIN_PLACE_API, {
    handleBusinessServiceAreaError: false,
  });

  const hasSearchQuery = query.trim().length >= 2;

  const showNoResults =
    hasSearchQuery &&
    !isLoading &&
    !error &&
    !isSearchRateLimited &&
    suggestions.length === 0;

  const resetSearch = () => {
    setQuery("");
    setResolvingPlaceId(null);
    clearSuggestions();
  };

  const selectSuggestion = async (suggestion: PlaceSuggestion) => {
    if (resolvingPlaceId) {
      return;
    }

    setResolvingPlaceId(suggestion.placeId);

    const location = await getPlaceDetails(suggestion.placeId);

    setResolvingPlaceId(null);

    if (!location) {
      return;
    }

    onPlaceSelect(location.latitude, location.longitude, suggestion.mainText);

    sheetRef.current?.dismiss();
  };

  const isSheetOpenRef = useRef(false);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!isSheetOpenRef.current) {
          return false;
        }

        sheetRef.current?.dismiss();

        // Consume this Back press so Expo Router does not also navigate back.
        return true;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [sheetRef]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["94%"]}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
      backgroundStyle={{
        backgroundColor: theme.extends.colors.background,
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.extends.colors.text.disabled,
        width: 40,
      }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.45}
        />
      )}
      onChange={(index) => {
        isSheetOpenRef.current = index >= 0;
      }}
      onDismiss={() => {
        isSheetOpenRef.current = false;
        resetSearch();
      }}
    >
      <View className="flex-1 px-5 pt-2">
        {/* Search heading */}
        <AppText weight="bold" className="text-xl text-text-primary">
          Search starting point
        </AppText>

        <AppText className="mt-1 text-sm text-text-secondary">
          Find a place or landmark, then inspect it on the map.
        </AppText>

        {/* Search input */}
        <View className="mt-4 min-h-12 flex-row items-center rounded-xl border border-border-primary bg-surface px-4">
          <MaterialCommunityIcons
            name="magnify"
            size={21}
            color={theme.extends.colors.text.secondary}
          />

          <BottomSheetTextInput
            autoFocus
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              searchPlaces(value);
            }}
            placeholder="Search place or landmark"
            placeholderTextColor={theme.extends.colors.text.secondary}
            returnKeyType="search"
            className="ml-3 h-12 flex-1 text-sm text-text-primary"
            accessibilityLabel="Search starting point"
          />

          {isLoading ? (
            <ActivityIndicator
              size="small"
              color={theme.extends.colors.brand}
            />
          ) : query.length > 0 ? (
            <Pressable
              onPress={resetSearch}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear place search"
              className="h-10 w-10 cursor-pointer items-center justify-center rounded-full active:bg-surface-secondary"
            >
              <MaterialCommunityIcons
                name="close"
                size={19}
                color={theme.extends.colors.text.secondary}
              />
            </Pressable>
          ) : null}
        </View>

        {/* Search feedback and results */}
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-12 pt-4"
        >
          {!hasSearchQuery ? (
            <PlaceSearchFeedback variant="initial" />
          ) : isSearchRateLimited ? (
            <PlaceSearchFeedback variant="rate-limited" />
          ) : error ? (
            <PlaceSearchFeedback
              variant="error"
              onRetry={() => searchPlaces(query)}
            />
          ) : showNoResults ? (
            <PlaceSearchFeedback variant="no-results" />
          ) : (
            suggestions.map((suggestion) => (
              <PlaceSuggestionRow
                key={suggestion.placeId}
                suggestion={suggestion}
                isResolving={resolvingPlaceId === suggestion.placeId}
                disabled={resolvingPlaceId !== null}
                onPress={() => void selectSuggestion(suggestion)}
              />
            ))
          )}
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
}
