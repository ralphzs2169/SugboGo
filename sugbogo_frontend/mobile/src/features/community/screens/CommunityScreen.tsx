import LottieView from "lottie-react-native";
import { useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { theme } from "@/constants/theme";
import useExploreFilterOptions from "@/features/explore/hooks/useExploreFilterOptions";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import Button from "@/shared/components/Button";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";

import CommunityEmptyState from "../components/CommunityEmptyState";
import CommunityFeedSkeleton from "../components/CommunityFeedSkeleton";
import CommunityFilters from "../components/CommunityFilters";
import CommunityHeader from "../components/CommunityHeader";
import CommunityReviewCard from "../components/CommunityReviewCard";
import { useCommunityReviews } from "../hooks/useCommunityReviews";
import {
  DEFAULT_COMMUNITY_REVIEW_FILTERS,
  type CommunityReviewFilters,
} from "../types/communityReview.types";

/**
 * Displays the production Community review feed.
 *
 * The screen coordinates authoritative taxonomy filters, backend pagination,
 * refresh and error states, defensive review deduplication, and tab-aware
 * spacing while dedicated components own review presentation.
 */
export default function CommunityScreen() {
  const bottomSpacing = useTabBarSpacing(20);
  const isEndReachedRef = useRef(false);

  const [filters, setFilters] = useState<CommunityReviewFilters>(
    DEFAULT_COMMUNITY_REVIEW_FILTERS,
  );

  const community = useCommunityReviews(filters);
  const taxonomy = useExploreFilterOptions();

  useQueryErrorNotification({
    error: community.error,
    toastId: "community-reviews",
    title: "Unable to load Community",
    fallbackMessage: "Please try again.",
  });

  useQueryErrorNotification({
    error: taxonomy.error,
    toastId: "community-review-filters",
    title: "Unable to load categories",
    fallbackMessage: "You can still browse all Community reviews.",
  });

  const reviews = useMemo(() => {
    const seenReviewIds = new Set<number>();

    return community.reviews.filter((review) => {
      if (seenReviewIds.has(review.id)) {
        return false;
      }

      seenReviewIds.add(review.id);
      return true;
    });
  }, [community.reviews]);

  const hasContentFilters = filters.clusterId !== null || filters.hasPhotos;

  const hasListError = Boolean(
    community.error && !community.isFetchNextPageError && reviews.length === 0,
  );

  const displayedReviews = hasListError ? [] : reviews;

  const isUpdatingResults =
    community.isPlaceholderData &&
    community.isFetching &&
    !community.isInitialLoading &&
    !community.isFetchingNextPage;

  const clearContentFilters = () => {
    setFilters((current) => ({
      ...DEFAULT_COMMUNITY_REVIEW_FILTERS,
      ordering: current.ordering,
    }));
  };

  const loadNextPage = () => {
    if (
      isEndReachedRef.current ||
      !community.hasNextPage ||
      community.isFetchingNextPage ||
      community.isFetching ||
      community.isPlaceholderData
    ) {
      return;
    }

    isEndReachedRef.current = true;

    void community.fetchNextPage().finally(() => {
      isEndReachedRef.current = false;
    });
  };

  const shouldShowEndMessage =
    !community.isInitialLoading &&
    !community.error &&
    !community.hasNextPage &&
    !community.isFetchingNextPage &&
    displayedReviews.length > 0;

  return (
    <View className="flex-1 bg-background">
      {/* Community introduction */}
      <CommunityHeader />

      {/* Filtered and paginated review feed */}
      <FlatList
        testID="community-review-list"
        data={displayedReviews}
        keyExtractor={(review) => String(review.id)}
        renderItem={({ item }) => (
          <View
            pointerEvents={isUpdatingResults ? "none" : "auto"}
            className={`px-4 pt-3 ${
              isUpdatingResults ? "opacity-60" : "opacity-100"
            }`}
          >
            <CommunityReviewCard review={item} />
          </View>
        )}
        ListHeaderComponent={
          <CommunityFilters
            clusters={taxonomy.options.clusters}
            isLoadingClusters={taxonomy.isLoading}
            hasClusterError={Boolean(taxonomy.error)}
            filters={filters}
            onChange={setFilters}
            onRetryClusters={() => void taxonomy.refetch()}
          />
        }
        ListEmptyComponent={
          community.isInitialLoading ? (
            <CommunityFeedSkeleton />
          ) : hasListError ? (
            <View className="min-h-[420px]" testID="community-error">
              <ErrorState
                title="Unable to load Community"
                description="We couldn't load Community reviews right now. Please try again."
                primaryActionTitle="Retry"
                onPrimaryAction={() => void community.refetch()}
              />
            </View>
          ) : (
            <CommunityEmptyState
              isFiltered={hasContentFilters}
              onClearFilters={clearContentFilters}
            />
          )
        }
        ListFooterComponent={
          community.isFetchingNextPage ? (
            <View className="items-center py-5" testID="community-page-loader">
              <LottieView
                source={loadingAnimation}
                autoPlay
                loop
                style={{ width: 50, height: 50 }}
              />
            </View>
          ) : community.isFetchNextPageError ? (
            <View className="items-center py-5">
              <Button
                title="Retry loading reviews"
                onPress={loadNextPage}
                variant="soft"
                rounded="full"
                size="sm"
              />
            </View>
          ) : shouldShowEndMessage ? (
            <EndOfListMessage description="You've seen every Community review." />
          ) : null
        }
        contentContainerStyle={{ paddingBottom: bottomSpacing }}
        onEndReached={loadNextPage}
        onEndReachedThreshold={0.35}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={community.isRefetching && !community.isFetchingNextPage}
            onRefresh={() => void community.refetch()}
            tintColor={theme.extends.colors.brand}
          />
        }
      />

      {/* Filter update feedback */}
      {isUpdatingResults && (
        <View
          testID="community-filter-update-loader"
          pointerEvents="none"
          className="absolute left-0 right-0 top-1/2 z-20 items-center"
        >
          <View className="rounded-full bg-surface/90 p-2">
            <LottieView
              source={loadingAnimation}
              autoPlay
              loop
              style={{ width: 36, height: 36 }}
            />
          </View>
        </View>
      )}
    </View>
  );
}
