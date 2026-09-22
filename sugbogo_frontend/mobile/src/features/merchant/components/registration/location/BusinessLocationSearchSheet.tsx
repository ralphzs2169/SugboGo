import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import useRegistrationPlaceSearch from "@/features/merchant/hooks/registration/useRegistrationPlaceSearch";
import AppText from "@/shared/components/AppText";
import PlaceSearchFeedback from "@/shared/components/place-search/PlaceSearchFeedback";
import PlaceSuggestionRow from "@/shared/components/place-search/PlaceSuggestionRow";
import type {
  BusinessLocation,
  PlaceSuggestion,
} from "@/shared/types/BusinessLocation.types";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  onPlaceSelect: (location: BusinessLocation) => void;
};

/**
 * Provides a keyboard-friendly place search for business registration.
 *
 * Preserves registration-specific search and service-area behavior while
 * sharing SugboGo's established place-search presentation and feedback states.
 */
export default function BusinessLocationSearchSheet({
  sheetRef,
  onPlaceSelect,
}: Props) {
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState("");
  const [resolvingPlaceId, setResolvingPlaceId] = useState<string | null>(null);

  const isSheetOpenRef = useRef(false);

  const {
    suggestions,
    isLoading,
    isDebouncing,
    isSearchSuccess,
    searchError,
    isSearchRateLimited,
    searchPlaces,
    getPlaceDetails,
    clearSuggestions,
  } = useRegistrationPlaceSearch();

  const hasSearchQuery = query.trim().length >= 2;
  const isSearchPending = isLoading || isDebouncing;

  const showNoResults =
    hasSearchQuery &&
    isSearchSuccess &&
    !isSearchPending &&
    !searchError &&
    !isSearchRateLimited &&
    suggestions.length === 0 &&
    resolvingPlaceId === null;

  function resetSearch() {
    setQuery("");
    setResolvingPlaceId(null);
    clearSuggestions();
  }

  async function selectSuggestion(suggestion: PlaceSuggestion) {
    if (resolvingPlaceId !== null) {
      return;
    }

    setResolvingPlaceId(suggestion.placeId);

    try {
      const location = await getPlaceDetails(suggestion.placeId);

      if (!location) {
        return;
      }

      onPlaceSelect(location);
      sheetRef.current?.dismiss();
    } finally {
      setResolvingPlaceId(null);
    }
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!isSheetOpenRef.current) {
          return false;
        }

        sheetRef.current?.dismiss();

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
          Search business location
        </AppText>

        <AppText className="mt-1 text-sm text-text-secondary">
          Find your business or a nearby place, then inspect it on the map.
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
            placeholder="Search your business location"
            placeholderTextColor={theme.extends.colors.text.secondary}
            returnKeyType="search"
            className="ml-3 h-12 flex-1 text-sm text-text-primary"
            accessibilityLabel="Search your business location"
          />

          {isSearchPending ? (
            <ActivityIndicator
              size="small"
              color={theme.extends.colors.brand}
            />
          ) : query.length > 0 ? (
            <Pressable
              onPress={resetSearch}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear business location search"
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
          contentContainerStyle={{
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom, 32),
          }}
        >
          {!hasSearchQuery ? (
            <PlaceSearchFeedback
              variant="initial"
              title="Find your business location"
              description="Search for your business, a place, or a nearby landmark in Cebu City."
            />
          ) : isSearchRateLimited ? (
            <PlaceSearchFeedback variant="rate-limited" />
          ) : searchError ? (
            <PlaceSearchFeedback
              variant="error"
              onRetry={() => searchPlaces(query)}
            />
          ) : showNoResults ? (
            <PlaceSearchFeedback
              variant="no-results"
              description="Try a different business, place, or landmark name."
            />
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
