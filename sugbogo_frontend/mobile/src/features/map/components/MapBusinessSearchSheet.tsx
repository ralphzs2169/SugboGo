import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
  ANIMATION_STATUS,
  useBottomSheetInternal,
} from "@gorhom/bottom-sheet";
import LottieView from "lottie-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAnimatedReaction } from "react-native-reanimated";
import { State, type TextInput } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { BackHandler, Keyboard, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import BusinessCard from "@/features/explore/components/new-businesses/BusinessCard";
import type { ExploreBusiness } from "@/features/explore/types/exploreBusiness.types";
import AppText from "@/shared/components/AppText";
import RecentSearches from "@/features/explore/components/search-filter-results/RecentSearches";
import SearchInitialState from "@/features/explore/components/search-filter-results/SearchInitialState";
import SimilarMatchesNotice from "@/features/explore/components/search-filter-results/SimilarMatchesNotice";
import SearchFilterEmptyState from "@/features/explore/components/search-filter-results/SearchFilterEmptyState";
import { useRecentSearchesStore } from "@/features/explore/stores/recentSearches.store";
import ErrorState from "@/shared/components/ErrorState";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";

import useMapBusinessSearch from "../hooks/useMapBusinessSearch";
import useResultsImpressions from "@/features/explore/hooks/useResultsImpressions";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  onBusinessSelect: (business: ExploreBusiness) => void;
  onVisibilityChange?: (visible: boolean) => void;
  impressionsEnabled?: boolean;
};

/** Observe actual animation completion, including keyboard moves with an unchanged index. */
function SearchSheetSettlementObserver({
  onSettledChange,
}: {
  onSettledChange: (settled: boolean) => void;
}) {
  const {
    animatedAnimationState,
    animatedContentGestureState,
    animatedHandleGestureState,
    animatedIndex,
    animatedPosition,
  } = useBottomSheetInternal();

  useAnimatedReaction(
    () =>
      animatedAnimationState.get().status === ANIMATION_STATUS.STOPPED &&
      animatedIndex.get() >= 0 &&
      Number.isFinite(animatedPosition.get()) &&
      animatedContentGestureState.get() !== State.BEGAN &&
      animatedContentGestureState.get() !== State.ACTIVE &&
      animatedHandleGestureState.get() !== State.BEGAN &&
      animatedHandleGestureState.get() !== State.ACTIVE,
    (settled, previous) => {
      if (settled !== previous) scheduleOnRN(onSettledChange, settled);
    },
  );
  return null;
}

/**
 * Shares Explore's search states and history inside the map's search sheet.
 * Search remains global and independent of the camera and applied map filters.
 */
export default function MapBusinessSearchSheet({
  sheetRef,
  onBusinessSelect,
  onVisibilityChange,
  impressionsEnabled = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isSettled, setIsSettled] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const isSheetOpen = useRef(false);
  const selectedResult = useRef(false);
  const pendingSelection = useRef<ExploreBusiness | null>(null);
  const endReached = useRef(false);
  const results = useMapBusinessSearch(query, isOpen);
  const history = useRecentSearchesStore();
  const businessIds = useMemo(
    () => results.businesses.map((business) => business.id),
    [results.businesses],
  );
  const impressions = useResultsImpressions(
    isOpen && isSettled && impressionsEnabled && results.isCurrentData,
    businessIds,
  );

  const pauseImpressions = useCallback(() => {
    setIsSettled(false);
  }, []);

  useQueryErrorNotification({
    error: results.error,
    toastId: "map-business-search",
    title: "Could not search businesses",
    fallbackMessage: "Please try again.",
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!isSheetOpen.current) {
          return false;
        }

        Keyboard.dismiss();
        pauseImpressions();
        sheetRef.current?.dismiss();
        return true;
      },
    );

    return () => subscription.remove();
  }, [sheetRef, pauseImpressions]);

  const close = () => {
    pauseImpressions();
    Keyboard.dismiss();
    sheetRef.current?.dismiss();
  };

  const shouldShowEndMessage =
    results.hasQuery &&
    !results.isPending &&
    !results.error &&
    !results.isPaused &&
    !results.hasNextPage &&
    !results.isFetchingNextPage &&
    results.businesses.length >= 5;

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["94%"]}
      topInset={insets.top}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{
        backgroundColor: theme.extends.colors.surface,
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
      onAnimate={() => {
        setIsSettled(false);
        onVisibilityChange?.(true);
      }}
      onChange={(index) => {
        const wasOpen = isSheetOpen.current;
        isSheetOpen.current = index >= 0;
        setIsOpen(index >= 0);
        if (index < 0) setIsSettled(false);
        if (index >= 0) onVisibilityChange?.(true);
        if (index >= 0 && !wasOpen) {
          selectedResult.current = false;
          pendingSelection.current = null;
        }
      }}
      onDismiss={() => {
        pauseImpressions();
        onVisibilityChange?.(false);
        isSheetOpen.current = false;
        setIsOpen(false);
        setQuery("");
        Keyboard.dismiss();
        const selectedBusiness = pendingSelection.current;
        pendingSelection.current = null;
        if (selectedBusiness) {
          onBusinessSelect(selectedBusiness);
        }
      }}
    >
      <SearchSheetSettlementObserver onSettledChange={setIsSettled} />
      {/* Search input and explicit dismissal */}
      <View className="px-5 pb-4 pt-2">
        <View className="flex-row items-center justify-between">
          <AppText weight="bold" className="text-xl text-text-primary">
            Find a business
          </AppText>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close business search"
            className="h-12 w-12 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
          >
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>
        </View>
        <AppText className="text-sm text-text-secondary">
          Find registered businesses across Cebu. Map filters do not apply here.
        </AppText>
        <View className="mt-4 min-h-12 flex-row items-center rounded-full border border-border-primary bg-surface px-3">
          <MaterialCommunityIcons
            name="magnify"
            size={21}
            color={theme.extends.colors.text.secondary}
          />
          <BottomSheetTextInput
            ref={searchInputRef}
            autoFocus
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={(event) => {
              void history.addQuery(event.nativeEvent.text);
            }}
            maxLength={200}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            placeholder="Business, category, or specialty"
            accessibilityLabel="Search SugboGo businesses"
            className="ml-3 min-h-12 flex-1 text-sm text-text-primary"
          />
          {query.length > 0 && (
            <Pressable
              onPress={() => setQuery("")}
              accessibilityRole="button"
              accessibilityLabel="Clear business search"
              className="h-12 w-12 cursor-pointer items-center justify-center active:opacity-70"
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color={theme.extends.colors.text.secondary}
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* Registered businesses and localized recovery */}
      <BottomSheetFlatList<ExploreBusiness>
        testID="map-business-search-results"
        data={results.businesses}
        onViewableItemsChanged={impressions.onViewableItemsChanged}
        viewabilityConfig={impressions.viewabilityConfig}
        keyExtractor={(business) => String(business.id)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 32),
          gap: 12,
        }}
        renderItem={({ item }) => (
          <View className="px-4">
            <BusinessCard
              business={item}
              variant="compact"
              highlightQuery={results.highlightQuery}
              distance={null}
              distanceAccuracy={null}
              onPress={() => {
                if (selectedResult.current) {
                  return;
                }
                selectedResult.current = true;
                pendingSelection.current = item;
                close();
              }}
            />
          </View>
        )}
        ListHeaderComponent={
          results.hasQuery ? (
            <View className="px-4 pb-1">
              {!results.isPending && !results.error && !results.isPaused && (
                <>
                  <AppText className="text-sm text-text-secondary">
                    {results.totalItems}{" "}
                    {results.totalItems === 1 ? "place" : "places"}
                  </AppText>
                  {isOpen &&
                    results.businesses.length > 0 &&
                    results.usedFuzzyFallback && <SimilarMatchesNotice />}
                </>
              )}
              {results.isUpdating && (
                <View
                  className="flex-row items-center gap-2 pb-2"
                  accessibilityRole="progressbar"
                  accessibilityLabel="Updating search results"
                >
                  <LottieView
                    source={loadingAnimation}
                    autoPlay
                    loop
                    style={{ width: 24, height: 24 }}
                  />
                  <AppText className="text-xs text-text-secondary">
                    Updating results…
                  </AppText>
                </View>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !results.hasQuery ? (
            history.queries.length > 0 ? (
              <View className="px-5 pt-4">
                <RecentSearches
                  key={history.scope}
                  queries={history.queries}
                  onSelect={(recentQuery) => {
                    setQuery(recentQuery);
                    void history.addQuery(recentQuery);
                  }}
                  onRemove={history.removeQuery}
                  onClear={history.clearQueries}
                />
              </View>
            ) : history.isHydrated ? (
              <SearchInitialState />
            ) : (
              <AppText className="px-5 py-8 text-sm text-text-secondary">
                Loading recent searches…
              </AppText>
            )
          ) : results.isUpdating ? null : (
            <SearchFilterEmptyState
              isLoading={results.isInitialLoading}
              hasError={Boolean(results.error || results.isPaused)}
              hasSearch
              onRetry={() => void results.refetch()}
              onGoBack={close}
              isRetrying={results.isRefetching && !results.isFetchingNextPage}
            />
          )
        }
        ListFooterComponent={
          !results.hasQuery || results.isPending ? null : results.error &&
            results.businesses.length > 0 ? (
            <ErrorState
              size="section"
              title="Could not load more businesses"
              description="Retry loading these search results."
              primaryActionTitle="Retry"
              onPrimaryAction={() => void results.refetch()}
            />
          ) : results.isFetchingNextPage ? (
            <View className="items-center py-5">
              <LottieView
                source={loadingAnimation}
                autoPlay
                loop
                style={{ width: 50, height: 50 }}
              />
            </View>
          ) : shouldShowEndMessage ? (
            <EndOfListMessage description="You've reached the end of these search results." />
          ) : null
        }
        onMomentumScrollBegin={() => {
          endReached.current = false;
        }}
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (
            isOpen &&
            results.hasQuery &&
            !endReached.current &&
            results.hasNextPage &&
            !results.isFetching &&
            !results.isPending
          ) {
            endReached.current = true;
            void results.fetchNextPage();
          }
        }}
      />
    </BottomSheetModal>
  );
}
