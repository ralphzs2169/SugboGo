import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router, useLocalSearchParams } from "expo-router";
import LottieView from "lottie-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import Button from "@/shared/components/Button";
import AppText from "@/shared/components/AppText";
import useUserLocation from "@/shared/hooks/useUserLocation";
import useNavigationAction from "@/shared/hooks/useNavigationAction";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { calculateDistanceInKm } from "@/shared/utils/distance.utils";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import BusinessCard from "@/features/pockets/components/PocketBusinessCard";
import SearchFilterBottomSheet from "../components/search-filter-results/SearchFilterBottomSheet";
import SearchFilterEmptyState from "../components/search-filter-results/SearchFilterEmptyState";
import SearchFilterResultsHeader from "../components/search-filter-results/SearchFilterResultsHeader";
import SearchFilterResultsTopBar from "../components/search-filter-results/SearchFilterResultsTopBar";
import RecentSearches from "../components/search-filter-results/RecentSearches";
import SearchInitialState from "../components/search-filter-results/SearchInitialState";
import useDiscoveryResults from "../hooks/useDiscoveryResults";
import useExploreFilterOptions from "../hooks/useExploreFilterOptions";
import ExploreFilterOptionsFeedback from "../components/ExploreFilterOptionsFeedback";
import useResultsImpressions from "../hooks/useResultsImpressions";
import { useRecentSearchesStore } from "../stores/recentSearches.store";
import type {
  ExploreBusiness,
  ExploreResultsCriteria,
} from "../types/exploreBusiness.types";
import {
  applyClusterSelection,
  getTaxonomyFilterCount,
} from "../utils/exploreResultsCriteria";

const SEARCH_DEBOUNCE_MS = 350;

function parsePositiveId(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number(rawValue);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseCategoryIds(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue) {
    return [];
  }

  return [
    ...new Set(
      rawValue
        .split(",")
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
}

/**
 * Displays searchable and filterable Explore business results.
 *
 * Coordinates route-derived criteria, debounced search, taxonomy filtering,
 * pagination, business navigation, location-aware distances, refresh behavior,
 * and impression tracking while delegating presentation to focused components.
 */
export default function SearchFilterResultsScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const navigate = useNavigationAction();
  const goBack = () =>
    navigate(() => {
      if (!router.canGoBack()) return false;
      router.back();
    });

  const filterSheetRef = useRef<BottomSheetModal | null>(null);
  const didOpenInitialFilters = useRef(false);
  const isEndReachedRef = useRef(false);

  const initialCriteria = useMemo<ExploreResultsCriteria>(
    () => ({
      search:
        typeof params.search === "string" ? params.search.slice(0, 200) : "",
      clusterId: parsePositiveId(params.clusterId),
      categoryIds: parseCategoryIds(params.categoryIds),
      specialtyTagId: parsePositiveId(params.specialtyTagId),
    }),
    [
      params.categoryIds,
      params.clusterId,
      params.search,
      params.specialtyTagId,
    ],
  );

  const [search, setSearch] = useState(initialCriteria.search);
  const [debouncedSearch, setDebouncedSearch] = useState(
    initialCriteria.search.trim(),
  );
  const [appliedCriteria, setAppliedCriteria] = useState(initialCriteria);
  const [draftCriteria, setDraftCriteria] = useState(initialCriteria);
  const history = useRecentSearchesStore();
  const hasSearch = search.trim().length > 0;
  const hasAppliedFilters =
    appliedCriteria.clusterId !== null ||
    appliedCriteria.categoryIds.length > 0 ||
    appliedCriteria.specialtyTagId !== null;
  const isInitialSearch = !hasSearch && !hasAppliedFilters;
  // Wait for live text to settle, but clearing text keeps applied filters active.
  const resultsEnabled =
    !isInitialSearch && (!hasSearch || search.trim() === debouncedSearch);
  const hasDebouncedCriteria = hasAppliedFilters || debouncedSearch.length > 0;

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [search]);

  const queryCriteria = useMemo(
    () => ({
      ...appliedCriteria,
      search: hasSearch ? debouncedSearch : "",
    }),
    [appliedCriteria, debouncedSearch, hasSearch],
  );

  const results = useDiscoveryResults(queryCriteria, resultsEnabled);
  const isInitialLoading = resultsEnabled && results.isLoading;
  const isUpdating =
    !isInitialSearch &&
    !isInitialLoading &&
    !results.isPaused &&
    (!resultsEnabled ||
      results.isPlaceholderData ||
      (results.isFetching && !results.isFetchingNextPage));
  const taxonomy = useExploreFilterOptions();
  const resultBusinessIds = useMemo(
    () => results.businesses.map((business) => business.id),
    [results.businesses],
  );
  const impressions = useResultsImpressions(
    resultsEnabled && results.isCurrentData,
    resultBusinessIds,
  );
  const { location: userLocation } = useUserLocation();

  const replaySearch = (query: string) => {
    setSearch(query);
    void history.addQuery(query);
  };

  useEffect(() => {
    if (!resultsEnabled || !results.error) {
      return;
    }

    const response = results.error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: "Unable to load places",
        text2: response.message || "Please try again.",
      });
    }
  }, [results.error, resultsEnabled]);

  useEffect(() => {
    if (
      params.openFilters !== "1" ||
      taxonomy.isLoading ||
      didOpenInitialFilters.current
    ) {
      return;
    }

    didOpenInitialFilters.current = true;
    setDraftCriteria(appliedCriteria);
    presentBottomSheet(filterSheetRef);
  }, [appliedCriteria, params.openFilters, taxonomy.isLoading]);

  const openFilters = () => {
    setDraftCriteria({
      ...appliedCriteria,
      search,
    });

    presentBottomSheet(filterSheetRef);
  };

  const applyFilters = () => {
    setAppliedCriteria({
      ...draftCriteria,
      search,
    });

    filterSheetRef.current?.dismiss();
  };

  const selectCluster = (clusterId: number | null) => {
    setAppliedCriteria((current) =>
      applyClusterSelection(current, clusterId, taxonomy.options.categories),
    );
  };

  const removeCategory = (categoryId: number) => {
    setAppliedCriteria((current) => ({
      ...current,
      categoryIds: current.categoryIds.filter((id) => id !== categoryId),
    }));
  };

  const removeSpecialty = () => {
    setAppliedCriteria((current) => ({
      ...current,
      specialtyTagId: null,
    }));
  };

  const activeFilterCount = getTaxonomyFilterCount(appliedCriteria);

  const selectedCategories = taxonomy.options.categories.filter((category) =>
    appliedCriteria.categoryIds.includes(category.id),
  );

  const selectedSpecialty = taxonomy.options.specialty_tags.find(
    (specialty) => specialty.id === appliedCriteria.specialtyTagId,
  );

  const openBusiness = useCallback(
    (business: ExploreBusiness, distance: number | null) => {
      navigate(() =>
        router.push({
          pathname: "/(explorer)/business/[businessId]",
          params: {
            businessId: String(business.id),
            profileSource: "SEARCH_RESULTS",
            distance: distance === null ? "" : String(distance),
            distanceAccuracy:
              userLocation?.coords.accuracy === null ||
              userLocation?.coords.accuracy === undefined
                ? ""
                : String(userLocation.coords.accuracy),
          },
        }),
      );
    },
    [navigate, userLocation],
  );

  const renderBusiness = useCallback(
    ({ item }: { item: ExploreBusiness }) => {
      const distance = userLocation
        ? calculateDistanceInKm(
            userLocation.coords.latitude,
            userLocation.coords.longitude,
            item.location.latitude,
            item.location.longitude,
          )
        : null;

      return (
        <View className="mb-3 px-4">
          {/* Business result */}
          <BusinessCard
            business={item}
            distance={distance}
            distanceAccuracy={userLocation?.coords.accuracy ?? null}
            onPress={() => openBusiness(item, distance)}
            variant="compact"
            highlightQuery={resultsEnabled ? results.highlightQuery : ""}
          />
        </View>
      );
    },
    [openBusiness, userLocation, resultsEnabled, results.highlightQuery],
  );

  const loadNextPage = (retryFailedPage = false) => {
    if (
      !resultsEnabled ||
      !results.isCurrentData ||
      isEndReachedRef.current ||
      (!retryFailedPage && results.isFetchNextPageError) ||
      !results.hasNextPage ||
      results.isFetchingNextPage ||
      results.isFetching
    ) {
      return;
    }

    isEndReachedRef.current = true;

    void results.fetchNextPage().finally(() => {
      isEndReachedRef.current = false;
    });
  };

  const shouldShowEndMessage =
    !isUpdating &&
    !results.isLoading &&
    !results.error &&
    !results.hasNextPage &&
    results.businesses.length >= 5;

  return (
    <View className="flex-1 bg-surface">
      {/* Search and filter controls */}
      <SearchFilterResultsTopBar
        search={search}
        autoFocus={params.focusSearch === "1"}
        activeFilterCount={activeFilterCount}
        isFilterLoading={taxonomy.isLoading}
        topInset={insets.top}
        onSearchChange={setSearch}
        onSearchSubmit={(query) => void history.addQuery(query)}
        onBack={goBack}
        onOpenFilters={openFilters}
      />
      <ExploreFilterOptionsFeedback state={taxonomy} />

      {/* Empty search is an invitation/history surface, never an unfiltered feed. */}
      {isInitialSearch ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            paddingBottom: Math.max(insets.bottom, 24),
          }}
        >
          {history.queries.length > 0 ? (
            <View className="px-5 pt-4">
              <RecentSearches
                key={history.scope}
                queries={history.queries}
                onSelect={replaySearch}
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
          )}
        </ScrollView>
      ) : (
        /* Paginated business results */
        <FlatList
          testID="search-filter-results-list"
          data={hasDebouncedCriteria ? results.businesses : []}
          keyExtractor={(business) => String(business.id)}
          renderItem={renderBusiness}
          ListHeaderComponent={
            <>
              {!hasSearch && history.queries.length > 0 && (
                <View className="px-5 py-3">
                  <RecentSearches
                    key={history.scope}
                    queries={history.queries}
                    onSelect={replaySearch}
                    onRemove={history.removeQuery}
                    onClear={history.clearQueries}
                  />
                </View>
              )}
              {(results.error || results.isPaused) &&
              results.businesses.length === 0 ? null : (
                <SearchFilterResultsHeader
                  clusters={taxonomy.options.clusters}
                  selectedClusterId={appliedCriteria.clusterId}
                  selectedCategories={selectedCategories}
                  selectedSpecialty={selectedSpecialty}
                  totalItems={results.totalItems}
                  isLoading={isInitialLoading}
                  usedFuzzyFallback={
                    resultsEnabled && results.usedFuzzyFallback
                  }
                  onSelectCluster={selectCluster}
                  onRemoveCategory={removeCategory}
                  onRemoveSpecialty={removeSpecialty}
                />
              )}
              {isUpdating && (
                <View
                  className="flex-row items-center gap-2 px-4 pb-3"
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
            </>
          }
          ListEmptyComponent={
            isUpdating ? null : (
              <SearchFilterEmptyState
                isLoading={isInitialLoading}
                hasError={Boolean(results.error || results.isPaused)}
                hasSearch={debouncedSearch.length > 0}
                onRetry={() => void results.refetch()}
                onGoBack={goBack}
                isRetrying={results.isRefetching && !results.isFetchingNextPage}
              />
            )
          }
          ListFooterComponent={
            !resultsEnabled ||
            !results.isCurrentData ? null : results.isFetchingNextPage ? (
              <View
                className="items-center py-5"
                testID="search-filter-results-page-loader"
              >
                {/* Pagination loader */}
                <LottieView
                  source={loadingAnimation}
                  autoPlay
                  loop
                  style={{
                    width: 50,
                    height: 50,
                  }}
                />
              </View>
            ) : results.isFetchNextPageError &&
              results.businesses.length > 0 ? (
              <View className="items-center py-5">
                <Button
                  title="Retry loading more places"
                  onPress={() => loadNextPage(true)}
                  variant="soft"
                  rounded="full"
                  size="sm"
                />
              </View>
            ) : shouldShowEndMessage ? (
              <EndOfListMessage description="You've reached the end of these results." />
            ) : null
          }
          contentContainerStyle={{
            paddingBottom: insets.bottom,
          }}
          onEndReached={() => loadNextPage()}
          onEndReachedThreshold={0.35}
          onViewableItemsChanged={impressions.onViewableItemsChanged}
          viewabilityConfig={impressions.viewabilityConfig}
          refreshControl={
            resultsEnabled && results.isCurrentData ? (
              <RefreshControl
                refreshing={results.isRefetching && !results.isFetchingNextPage}
                onRefresh={() => void results.refetch()}
                tintColor={theme.extends.colors.brand}
              />
            ) : undefined
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}

      {/* Search and taxonomy filters */}
      <SearchFilterBottomSheet
        sheetRef={filterSheetRef}
        options={taxonomy.options}
        taxonomyState={taxonomy}
        draft={draftCriteria}
        onChange={setDraftCriteria}
        onApply={applyFilters}
      />
    </View>
  );
}
