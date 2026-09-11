import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";
import useUserLocation from "@/shared/hooks/useUserLocation";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { calculateDistanceInKm } from "@/shared/utils/distance.utils";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import ExploreFiltersSheet from "../components/results/ExploreFiltersSheet";
import BusinessCard from "../components/new-businesses/BusinessCard";
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

/** Displays editable, paginated business results for every Explore intent. */
export default function ExploreResultsScreen() {
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

  const renderHeader = () => (
    <View>
      {/* Authoritative cluster quick filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-4 py-3"
      >
        {[{ id: null, name: "All" }, ...taxonomy.options.clusters].map(
          (cluster) => {
            const isSelected = cluster.id === appliedCriteria.clusterId;

            return (
              <Pressable
                key={cluster.id ?? "all"}
                onPress={() => selectCluster(cluster.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                className={`min-h-11 justify-center rounded-full px-4 active:opacity-70 ${
                  isSelected ? "bg-brand" : "bg-surface"
                }`}
              >
                <AppText
                  weight="semibold"
                  className={isSelected ? "text-white" : "text-text-secondary"}
                >
                  {cluster.name}
                </AppText>
              </Pressable>
            );
          },
        )}
      </ScrollView>

      {/* Removable applied taxonomy filters */}
      {(selectedCategories.length > 0 || selectedSpecialty) && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-4 pb-3"
        >
          {selectedCategories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => removeCategory(category.id)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${category.name} filter`}
              className="min-h-10 flex-row items-center rounded-full border border-border-primary bg-surface px-3 active:opacity-70"
            >
              <AppText
                weight="semibold"
                className="text-xs text-text-secondary"
              >
                {category.name}
              </AppText>
              <MaterialCommunityIcons
                name="close"
                size={16}
                color={theme.extends.colors.text.secondary}
                style={{ marginLeft: 5 }}
              />
            </Pressable>
          ))}

          {selectedSpecialty && (
            <Pressable
              onPress={() =>
                setAppliedCriteria((current) => ({
                  ...current,
                  specialtyTagId: null,
                }))
              }
              accessibilityRole="button"
              accessibilityLabel={`Remove ${selectedSpecialty.name} filter`}
              className="min-h-10 flex-row items-center rounded-full border border-border-primary bg-surface px-3 active:opacity-70"
            >
              <AppText
                weight="semibold"
                className="text-xs text-text-secondary"
              >
                {selectedSpecialty.name}
              </AppText>
              <MaterialCommunityIcons
                name="close"
                size={16}
                color={theme.extends.colors.text.secondary}
                style={{ marginLeft: 5 }}
              />
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* Results summary */}
      <View className="px-4 pb-4 pt-1">
        <AppText weight="bold" className="text-xl text-text-primary">
          Places
        </AppText>
        <AppText className="mt-0.5 text-sm text-text-secondary">
          {results.totalItems} {results.totalItems === 1 ? "result" : "results"}
        </AppText>
      </View>
    </View>
  );

  const renderListEmpty = () => {
    if (results.isLoading) {
      return (
        <View className="pt-4">
          {[0, 1, 2, 3].map((item) => (
            <View key={item} className="mb-3 flex-row px-4">
              <View className="h-[108px] w-[108px] rounded-xl bg-surface" />
              <View className="ml-3 flex-1 py-2">
                <View className="h-4 w-3/4 rounded-full bg-surface" />
                <View className="mt-3 h-3 w-1/2 rounded-full bg-surface" />
                <View className="mt-5 h-6 w-2/3 rounded-full bg-surface" />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (results.error) {
      return (
        <View className="min-h-[420px]">
          <ErrorState
            title="Unable to load places"
            description="We couldn't load these results. Please try again."
            primaryActionTitle="Retry"
            onPrimaryAction={() => void results.refetch()}
          />
        </View>
      );
    }

    const hasSearch = debouncedSearch.length > 0;

    return (
      <View className="items-center px-8 py-20">
        <MaterialCommunityIcons
          name="map-search-outline"
          size={58}
          color={theme.extends.colors.text.tertiary}
        />
        <AppText weight="bold" className="mt-4 text-lg text-text-primary">
          {hasSearch ? "No places found" : "No places match these filters."}
        </AppText>
        <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
          {hasSearch
            ? "Try another search or adjust your filters."
            : "Try adjusting or clearing a filter."}
        </AppText>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-surface">
      {/* Search header */}
      <View
        className="flex-row items-center gap-2 border-b border-border-primary bg-surface px-3 pb-3"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Back to Explore"
          className="h-12 w-12 items-center justify-center rounded-full active:bg-background"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.extends.colors.text.primary}
          />
        </Pressable>

        <View className="h-12 min-w-0 flex-1 flex-row items-center rounded-input border border-border-primary bg-background px-3">
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color={theme.extends.colors.text.tertiary}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            autoFocus={params.focusSearch === "1"}
            className="ml-2 min-w-0 flex-1 text-sm text-text-primary"
            style={{ fontFamily: "NunitoSans_400Regular" }}
            placeholder="Search businesses or places..."
            placeholderTextColor={theme.extends.colors.text.tertiary}
            returnKeyType="search"
            accessibilityLabel="Search businesses or places"
          />
          {search.length > 0 && (
            <Pressable
              onPress={() => setSearch("")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              className="h-10 w-10 items-center justify-center"
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={19}
                color={theme.extends.colors.text.tertiary}
              />
            </Pressable>
          )}
        </View>

        <Pressable
          onPress={openFilters}
          accessibilityRole="button"
          accessibilityLabel="Open discovery filters"
          className="relative h-12 w-12 items-center justify-center rounded-input border border-border-primary bg-background active:opacity-70"
        >
          <MaterialCommunityIcons
            name="tune-variant"
            size={22}
            color={theme.extends.colors.text.secondary}
          />
          {activeFilterCount > 0 && (
            <View className="absolute -right-1 -top-1 min-h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1">
              <AppText weight="bold" className="text-[10px] text-white">
                {activeFilterCount}
              </AppText>
            </View>
          )}
        </Pressable>
      </View>

      {/* Paginated result list */}
      <FlatList
        testID="explore-results-list"
        data={results.isLoading || results.error ? [] : results.businesses}
        keyExtractor={(business) => String(business.id)}
        renderItem={renderBusiness}
        ListHeaderComponent={
          results.isLoading || results.error ? null : renderHeader
        }
        ListEmptyComponent={renderListEmpty}
        ListFooterComponent={
          results.isFetchingNextPage ? (
            <View className="items-center py-5">
              <ActivityIndicator color={theme.extends.colors.brand} />
            </View>
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

      <ExploreFiltersSheet
        sheetRef={filterSheetRef}
        options={taxonomy.options}
        draft={draftCriteria}
        onChange={setDraftCriteria}
        onApply={applyFilters}
      />
    </View>
  );
}
