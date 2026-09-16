import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import usePlaceSearch from "@/shared/hooks/usePlaceSearch";
import type { PlaceSuggestion } from "@/shared/types/BusinessLocation.types";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  onPlaceSelect: (
    latitude: number,
    longitude: number,
    label: string,
  ) => void;
};

/**
 * Provides a keyboard-friendly, full-height place search for journey origins.
 *
 * Suggestions use the existing SugboGo Places integration and return to the
 * map after details resolve, without confirming the draft automatically.
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
  } = usePlaceSearch();
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

    onPlaceSelect(
      location.latitude,
      location.longitude,
      suggestion.mainText,
    );
    sheetRef.current?.dismiss();
  };

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
      onDismiss={resetSearch}
    >
      <View className="flex-1 px-5 pt-2">
        {/* Search heading and input */}
        <AppText weight="bold" className="text-xl text-text-primary">
          Search starting point
        </AppText>
        <AppText className="mt-1 text-sm text-text-secondary">
          Find a place or landmark, then inspect it on the map.
        </AppText>

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
            <View className="items-center px-5 py-10">
              <MaterialCommunityIcons
                name="map-search-outline"
                size={34}
                color={theme.extends.colors.text.tertiary}
              />
              <AppText className="mt-3 text-center text-sm text-text-secondary">
                Enter at least two characters to search.
              </AppText>
            </View>
          ) : isSearchRateLimited ? (
            <SearchMessage
              icon="timer-sand"
              title="Search paused"
              description="Please wait a moment before trying again."
            />
          ) : error ? (
            <SearchMessage
              icon="alert-circle-outline"
              title="Unable to search places"
              description="Check your connection, then try your search again."
              actionLabel="Try again"
              onAction={() => searchPlaces(query)}
            />
          ) : showNoResults ? (
            <SearchMessage
              icon="map-marker-off-outline"
              title="No matching places"
              description="Try a different place or landmark name."
            />
          ) : (
            suggestions.map((suggestion) => {
              const isResolving = resolvingPlaceId === suggestion.placeId;

              return (
                <Pressable
                  key={suggestion.placeId}
                  onPress={() => void selectSuggestion(suggestion)}
                  disabled={resolvingPlaceId !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${suggestion.mainText}`}
                  accessibilityState={{
                    disabled: resolvingPlaceId !== null,
                    busy: isResolving,
                  }}
                  className="min-h-16 cursor-pointer flex-row items-center border-b border-border-primary py-3 active:bg-surface"
                >
                  {isResolving ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.extends.colors.brand}
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name="map-marker-outline"
                      size={22}
                      color={theme.extends.colors.brand}
                    />
                  )}
                  <View className="ml-3 flex-1">
                    <AppText weight="semibold" className="text-text-primary">
                      {suggestion.mainText}
                    </AppText>
                    {suggestion.secondaryText ? (
                      <AppText className="mt-0.5 text-sm text-text-secondary">
                        {suggestion.secondaryText}
                      </AppText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })
          )}
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
}

type SearchMessageProps = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Displays an accessible search status inside the place-search sheet. */
function SearchMessage({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: SearchMessageProps) {
  return (
    <View className="items-center px-5 py-10">
      <MaterialCommunityIcons
        name={icon}
        size={34}
        color={theme.extends.colors.text.tertiary}
      />
      <AppText weight="bold" className="mt-3 text-center text-text-primary">
        {title}
      </AppText>
      <AppText className="mt-1 text-center text-sm text-text-secondary">
        {description}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          className="mt-4 min-h-11 cursor-pointer justify-center rounded-full border border-brand px-5 active:opacity-70"
        >
          <AppText weight="bold" className="text-brand">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
