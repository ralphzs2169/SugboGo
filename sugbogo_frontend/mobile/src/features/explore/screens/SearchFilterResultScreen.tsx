import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router, useLocalSearchParams } from "expo-router";
import LottieView from "lottie-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";
import useUserLocation from "@/shared/hooks/useUserLocation";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { calculateDistanceInKm } from "@/shared/utils/distance.utils";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import BusinessCard from "../components/new-businesses/BusinessCard";
import SearchFilterBottomSheet from "../components/search-filter-results/SearchFilterBottomSheet";
import SearchFilterEmptyState from "../components/search-filter-results/SearchFilterEmptyState";
import SearchFilterResultsHeader from "../components/search-filter-results/SearchFilterResultsHeader";
import SearchFilterResultsTopBar from "../components/search-filter-results/SearchFilterResultsTopBar";
import useDiscoveryResults from "../hooks/useDiscoveryResults";
import useExploreFilterOptions from "../hooks/useExploreFilterOptions";
import useResultsImpressions from "../hooks/useResultsImpressions";
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
  const bottomSpacing = useTabBarSpacing();

  const filterSheetRef = useRef<BottomSheetModal | null>(null);
  const didOpenInitialFilters = useRef(false);
  const isEndReachedRef = useRef(false);

  const initialCriteria = useMemo<ExploreResultsCriteria>(
    () => ({
      search: typeof params.search === "string" ? params.search : "",
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

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [search]);

  const queryCriteria = useMemo(
    () => ({
      ...appliedCriteria,
      search: debouncedSearch,
    }),
    [appliedCriteria, debouncedSearch],
  );

  const results = useDiscoveryResults(queryCriteria);
  const taxonomy = useExploreFilterOptions();
  const impressions = useResultsImpressions();
  const { location: userLocation } = useUserLocation();

  useEffect(() => {
    if (!results.error) {
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
  }, [results.error]);

  useEffect(() => {
    if (!taxonomy.error) {
      return;
    }

    const response = taxonomy.error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: "Unable to load filters",
        text2: response.message || "Please try again.",
      });
    }
  }, [taxonomy.error]);

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
      router.push({
        pathname: "/(explorer)/business/[businessId]",
        params: {
          businessId: String(business.id),
          distance: distance === null ? "" : String(distance),
          distanceAccuracy:
            userLocation?.coords.accuracy === null ||
            userLocation?.coords.accuracy === undefined
              ? ""
              : String(userLocation.coords.accuracy),
        },
      });
    },
    [userLocation],
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
          />
        </View>
      );
    },
    [openBusiness, userLocation],
  );

  const loadNextPage = () => {
    if (
      isEndReachedRef.current ||
      !results.hasNextPage ||
      results.isFetchingNextPage
    ) {
      return;
    }

    isEndReachedRef.current = true;

    void results.fetchNextPage().finally(() => {
      isEndReachedRef.current = false;
    });
  };

  const shouldShowEndMessage =
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
        onBack={() => router.back()}
        onOpenFilters={openFilters}
      />

      {/* Paginated business results */}
      <FlatList
        testID="search-filter-results-list"
        data={results.isLoading || results.error ? [] : results.businesses}
        keyExtractor={(business) => String(business.id)}
        renderItem={renderBusiness}
        ListHeaderComponent={
          results.error ? null : (
            <SearchFilterResultsHeader
              clusters={taxonomy.options.clusters}
              selectedClusterId={appliedCriteria.clusterId}
              selectedCategories={selectedCategories}
              selectedSpecialty={selectedSpecialty}
              totalItems={results.totalItems}
              isLoading={results.isLoading}
              onSelectCluster={selectCluster}
              onRemoveCategory={removeCategory}
              onRemoveSpecialty={removeSpecialty}
            />
          )
        }
        ListEmptyComponent={
          <SearchFilterEmptyState
            isLoading={results.isLoading}
            hasError={Boolean(results.error)}
            hasSearch={debouncedSearch.length > 0}
            onRetry={() => void results.refetch()}
            onGoBack={() => router.back()}
          />
        }
        ListFooterComponent={
          results.isFetchingNextPage ? (
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
          ) : shouldShowEndMessage ? (
            <EndOfListMessage description="You've reached the end of these results." />
          ) : null
        }
        contentContainerStyle={{
          paddingBottom: Math.max(bottomSpacing, insets.bottom + 24),
        }}
        onEndReached={loadNextPage}
        onEndReachedThreshold={0.35}
        onViewableItemsChanged={impressions.onViewableItemsChanged}
        viewabilityConfig={impressions.viewabilityConfig}
        refreshControl={
          <RefreshControl
            refreshing={results.isRefetching && !results.isFetchingNextPage}
            onRefresh={() => void results.refetch()}
            tintColor={theme.extends.colors.brand}
          />
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />

      {/* Search and taxonomy filters */}
      <SearchFilterBottomSheet
        sheetRef={filterSheetRef}
        options={taxonomy.options}
        draft={draftCriteria}
        onChange={setDraftCriteria}
        onApply={applyFilters}
      />
    </View>
  );
}
