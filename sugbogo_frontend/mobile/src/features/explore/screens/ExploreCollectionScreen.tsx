import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router, useLocalSearchParams } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import ErrorState from "@/shared/components/ErrorState";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";
import useUserLocation from "@/shared/hooks/useUserLocation";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { calculateDistanceInKm } from "@/shared/utils/distance.utils";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import BusinessCard from "../components/new-businesses/BusinessCard";
import ExploreCollectionEmptyState from "../components/explore-collection/ExploreCollectionEmptyState";
import ExploreCollectionResultsHeader, {
  type ExploreAppliedFilter,
} from "../components/explore-collection/ExploreCollectionResultsHeader";
import ExploreCollectionTopBar from "../components/explore-collection/ExploreCollectionTopBar";
import SearchFilterBottomSheet from "../components/search-filter-results/SearchFilterBottomSheet";
import useExploreCollection from "../hooks/useExploreCollection";
import useExploreFilterOptions from "../hooks/useExploreFilterOptions";
import useResultsImpressions from "../hooks/useResultsImpressions";

import { applyClusterSelection } from "../utils/exploreResultsCriteria";
import EndOfListMessage from "@/shared/components/EndOfListMessage";

import type {
  ExploreBusiness,
  ExploreCollectionBusiness,
  ExploreCollectionType,
  ExploreResultsCriteria,
} from "../types/exploreBusiness.types";

export const EXPLORE_COLLECTION_TITLES: Record<ExploreCollectionType, string> =
  {
    "worth-discovering": "Worth Discovering",
    interests: "Based on Your Interests",
    "new-businesses": "New to SugboGo",
  };

const EMPTY_CRITERIA: ExploreResultsCriteria = {
  search: "",
  clusterId: null,
  categoryIds: [],
  specialtyTagId: null,
};

export function isExploreCollectionType(
  value: string | string[] | undefined,
): value is ExploreCollectionType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(EXPLORE_COLLECTION_TITLES, value)
  );
}

/**
 * Displays a reusable filtered and paginated Explore collection.
 *
 * Owns collection querying, committed and draft filters, pagination, business
 * navigation, location-aware distances, and impression tracking while
 * delegating collection presentation states to focused child components.
 */
export default function ExploreCollectionScreen() {
  const params = useLocalSearchParams<{
    collectionType?: string;
    source?: string;
  }>();

  const insets = useSafeAreaInsets();
  const bottomSpacing = useTabBarSpacing();

  const filterSheetRef = useRef<BottomSheetModal | null>(null);
  const isEndReachedRef = useRef(false);

  const [appliedCriteria, setAppliedCriteria] =
    useState<ExploreResultsCriteria>(EMPTY_CRITERIA);

  const [draftCriteria, setDraftCriteria] =
    useState<ExploreResultsCriteria>(EMPTY_CRITERIA);

  const collectionType = isExploreCollectionType(params.collectionType)
    ? params.collectionType
    : null;

  const collection = useExploreCollection(collectionType, appliedCriteria);
  const taxonomy = useExploreFilterOptions();
  const impressions = useResultsImpressions();
  const { location: userLocation } = useUserLocation();

  const isRecommendationCollection =
    collectionType === "interests" && params.source === "recommendations";

  useEffect(() => {
    if (!collection.error) {
      return;
    }

    const response = collection.error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: "Unable to load collection",
        text2: response.message || "Please try again.",
      });
    }
  }, [collection.error]);

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

  if (collectionType === null) {
    return (
      <View className="flex-1 bg-surface" style={{ paddingTop: insets.top }}>
        {/* Invalid collection state */}
        <ErrorState
          title="Collection not found"
          description="Return to Explore and choose another collection."
          primaryActionTitle="Go back"
          onPrimaryAction={() => router.back()}
        />
      </View>
    );
  }

  const openFilters = () => {
    setDraftCriteria(appliedCriteria);
    presentBottomSheet(filterSheetRef);
  };

  const applyFilters = () => {
    setAppliedCriteria(draftCriteria);
    filterSheetRef.current?.dismiss();
  };

  const removeCluster = () => {
    setAppliedCriteria((current) =>
      applyClusterSelection(current, null, taxonomy.options.categories),
    );
  };

  const removeCategory = (categoryId: number) => {
    setAppliedCriteria((current) => ({
      ...current,
      categoryIds: current.categoryIds.filter((id) => id !== categoryId),
    }));
  };

  const selectedCluster = taxonomy.options.clusters.find(
    (cluster) => cluster.id === appliedCriteria.clusterId,
  );

  const selectedCategories = taxonomy.options.categories.filter((category) =>
    appliedCriteria.categoryIds.includes(category.id),
  );

  const selectedSpecialty = taxonomy.options.specialty_tags.find(
    (specialty) => specialty.id === appliedCriteria.specialtyTagId,
  );

  const appliedFilters: ExploreAppliedFilter[] = [
    ...(selectedCluster
      ? [
          {
            id: `cluster-${selectedCluster.id}`,
            label: selectedCluster.name,
            onRemove: removeCluster,
          },
        ]
      : []),

    ...selectedCategories.map((category) => ({
      id: `category-${category.id}`,
      label: category.name,
      onRemove: () => removeCategory(category.id),
    })),

    ...(selectedSpecialty
      ? [
          {
            id: `specialty-${selectedSpecialty.id}`,
            label: selectedSpecialty.name,
            onRemove: () =>
              setAppliedCriteria((current) => ({
                ...current,
                specialtyTagId: null,
              })),
          },
        ]
      : []),
  ];

  const activeFilterCount = appliedFilters.length;
  const hasActiveFilters = activeFilterCount > 0;

  const emptyTitle = hasActiveFilters
    ? isRecommendationCollection
      ? "No recommendations match these filters"
      : "No places match these filters"
    : isRecommendationCollection
      ? "No recommendations yet"
      : "No places available yet";

  const emptyDescription = hasActiveFilters
    ? "Try adjusting or clearing a filter."
    : isRecommendationCollection
      ? "Explore SugboGo to help us learn what interests you."
      : "Check back later for more places to discover.";

  const openBusiness = (business: ExploreBusiness, distance: number | null) => {
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
  };

  const renderBusiness = ({ item }: { item: ExploreCollectionBusiness }) => {
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
          recommendationReason={
            isRecommendationCollection
              ? (item.recommendation_reason ?? null)
              : null
          }
        />
      </View>
    );
  };

  const loadNextPage = () => {
    if (
      isEndReachedRef.current ||
      !collection.hasNextPage ||
      collection.isFetchingNextPage
    ) {
      return;
    }

    isEndReachedRef.current = true;

    void collection.fetchNextPage().finally(() => {
      isEndReachedRef.current = false;
    });
  };

  const shouldShowEndMessage =
    !collection.isLoading &&
    !collection.error &&
    !collection.hasNextPage &&
    collection.businesses.length >= 5;

  return (
    <View className="flex-1 bg-surface">
      {/* Collection navigation and controls */}
      <ExploreCollectionTopBar
        title={EXPLORE_COLLECTION_TITLES[collectionType]}
        activeFilterCount={activeFilterCount}
        isFilterLoading={taxonomy.isLoading}
        topInset={insets.top}
        onBack={() => router.back()}
        onOpenFilters={openFilters}
      />

      {/* Paginated collection results */}
      <FlatList
        testID="explore-collection-list"
        data={
          collection.isLoading || collection.error ? [] : collection.businesses
        }
        keyExtractor={(business) => String(business.id)}
        renderItem={renderBusiness}
        ListHeaderComponent={
          collection.error ? null : (
            <ExploreCollectionResultsHeader
              filters={appliedFilters}
              isLoading={collection.isLoading}
              totalItems={collection.totalItems}
            />
          )
        }
        ListEmptyComponent={
          <ExploreCollectionEmptyState
            isLoading={collection.isLoading}
            hasError={Boolean(collection.error)}
            onRetry={() => void collection.refetch()}
            onGoBack={() => router.back()}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
          />
        }
        ListFooterComponent={
          collection.isFetchingNextPage ? (
            <View className="items-center py-5" testID="collection-page-loader">
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
            <EndOfListMessage />
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
            refreshing={
              collection.isRefetching && !collection.isFetchingNextPage
            }
            onRefresh={() => void collection.refetch()}
            tintColor={theme.extends.colors.brand}
          />
        }
      />

      {/* Collection filters */}
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
