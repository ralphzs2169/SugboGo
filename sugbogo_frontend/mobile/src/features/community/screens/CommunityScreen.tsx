import LottieView from "lottie-react-native";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { hashKey } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { theme } from "@/constants/theme";
import useExploreFilterOptions from "@/features/explore/hooks/useExploreFilterOptions";
import ExploreQueryNotice from "@/features/explore/components/ExploreQueryNotice";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import Button from "@/shared/components/Button";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { useTabBarSpacing } from "@/shared/hooks/useTabBarSpacing";
import useNavigationAction from "@/shared/hooks/useNavigationAction";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import CommunityEmptyState from "../components/CommunityEmptyState";
import CommunityFeedSkeleton from "../components/CommunityFeedSkeleton";
import CommunityFilters from "../components/CommunityFilters";
import CommunityFilterBottomSheet from "../components/CommunityFilterBottomSheet";
import CommunityHeader from "../components/CommunityHeader";
import CommunityReviewCard from "../components/CommunityReviewCard";
import { useCommunityReviews } from "../hooks/useCommunityReviews";
import { communityReviewsKey } from "../hooks/communityReviewQueryKeys";
import {
  DEFAULT_COMMUNITY_REVIEW_FILTERS,
  type CommunityReview,
  type CommunityReviewBusiness,
  type CommunityReviewFilters,
} from "../types/communityReview.types";

/** Thin gap between full-width posts. */
function FeedSeparator() {
  return <View className="h-2" />;
}

/**
 * Displays the production Community review feed.
 *
 * The screen coordinates authoritative taxonomy filters, backend pagination,
 * refresh and error states, defensive review deduplication, and tab-aware
 * spacing while dedicated components own review presentation. The header and
 * quick filters stay pinned above the list so filtering is always reachable,
 * and posts render edge to edge, like a social feed.
 */
export default function CommunityScreen() {
  const navigate = useNavigationAction();
  const bottomSpacing = useTabBarSpacing(20);
  const listRef = useRef<FlatList<CommunityReview>>(null);
  const filterSheetRef = useRef<BottomSheetModal>(null);
  const isEndReachedRef = useRef(false);
  const isPaginationArmedRef = useRef(false);

  const [filters, setFilters] = useState<CommunityReviewFilters>(
    DEFAULT_COMMUNITY_REVIEW_FILTERS,
  );

  useEffect(() => {
    isEndReachedRef.current = false;
    isPaginationArmedRef.current = false;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [filters]);

  const community = useCommunityReviews(filters);
  const taxonomy = useExploreFilterOptions();

  useQueryErrorNotification({
    error:
      community.reviews.length > 0 && !community.isFetchNextPageError
        ? null
        : community.error,
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

  const hasContentFilters =
    filters.clusterId !== null ||
    filters.categoryIds.length > 0 ||
    filters.specialtyTagId !== null ||
    filters.hasPhotos;

  const hasListError = Boolean(
    community.error && !community.isFetchNextPageError && reviews.length === 0,
  );

  const displayedReviews = hasListError ? [] : reviews;
  const hasRefreshError = Boolean(
    community.error &&
    !community.isFetchNextPageError &&
    reviews.length > 0,
  );

  const applyFilters = (nextFilters: CommunityReviewFilters) => {
    setFilters((current) => {
      if (
        hashKey(communityReviewsKey(current)) ===
        hashKey(communityReviewsKey(nextFilters))
      ) {
        return current;
      }

      return nextFilters;
    });
  };

  const openFilters = () => presentBottomSheet(filterSheetRef);

  const togglePhotos = () => {
    setFilters((current) => ({ ...current, hasPhotos: !current.hasPhotos }));
  };

  const toggleMostHelpful = () => {
    setFilters((current) => ({
      ...current,
      ordering: current.ordering === "most_helpful" ? "newest" : "most_helpful",
    }));
  };

  const clearContentFilters = () => {
    setFilters((current) => ({
      ...DEFAULT_COMMUNITY_REVIEW_FILTERS,
      ordering: current.ordering,
    }));
  };

  const loadNextPage = (retryFailedPage: boolean) => {
    if (
      isEndReachedRef.current ||
      (!retryFailedPage &&
        (!isPaginationArmedRef.current || community.isFetchNextPageError)) ||
      !community.hasNextPage ||
      community.isFetchingNextPage ||
      community.isFetching ||
      community.isRefreshing
    ) {
      return;
    }

    isEndReachedRef.current = true;
    isPaginationArmedRef.current = false;

    void community.fetchNextPage().finally(() => {
      isEndReachedRef.current = false;
    });
  };

  const openBusiness = useCallback(
    (business: CommunityReviewBusiness) => {
      navigate(() =>
        router.push({
          pathname: "/(explorer)/business/[businessId]",
          params: {
            businessId: String(business.id),
            profileSource: "COMMUNITY",
          },
        }),
      );
    },
    [navigate],
  );

  const renderReview = useCallback(
    ({ item }: { item: CommunityReview }) => (
      <CommunityReviewCard review={item} onOpenBusiness={openBusiness} />
    ),
    [openBusiness],
  );

  const shouldShowEndMessage =
    !community.isInitialLoading &&
    !community.error &&
    !community.hasNextPage &&
    !community.isFetching &&
    !community.isFetchingNextPage &&
    displayedReviews.length > 0;

  return (
    <View className="flex-1 bg-background">
      {/* Pinned title, filter button, and quick filters */}
      <CommunityHeader>
        <CommunityFilters
          filters={filters}
          hasContentFilters={hasContentFilters}
          onOpenFilters={openFilters}
          onTogglePhotos={togglePhotos}
          onToggleMostHelpful={toggleMostHelpful}
          onClear={clearContentFilters}
        />
      </CommunityHeader>

      {/* Filtered and paginated review feed */}
      <FlatList
        ref={listRef}
        testID="community-review-list"
        data={displayedReviews}
        keyExtractor={(review) => String(review.id)}
        renderItem={renderReview}
        ItemSeparatorComponent={FeedSeparator}
        ListHeaderComponent={
          hasRefreshError ? (
            <ExploreQueryNotice
              message="Couldn't refresh. Showing previously loaded reviews."
              retryLabel="Retry refreshing Community reviews"
              onRetry={community.refresh}
            />
          ) : null
        }
        ListEmptyComponent={
          community.isPaused ? (
            <View className="min-h-[420px]" testID="community-offline">
              <ErrorState
                title="You're offline"
                primaryActionTextTone="primary"
                description="Connect to the internet to load Community reviews, then try again."
                primaryActionTitle="Retry"
                onPrimaryAction={() => void community.refetch()}
              />
            </View>
          ) : community.isInitialLoading ? (
            <CommunityFeedSkeleton />
          ) : hasListError ? (
            <View className="min-h-[420px]" testID="community-error">
              <ErrorState
                title="Unable to load Community"
                primaryActionTextTone="primary"
                description="We couldn't load Community reviews right now. Please try again."
                primaryActionTitle="Retry"
                onPrimaryAction={() => void community.refetch()}
              />
            </View>
          ) : community.hasData && community.isSuccess ? (
            <CommunityEmptyState
              isFiltered={hasContentFilters}
              onClearFilters={clearContentFilters}
            />
          ) : (
            <CommunityFeedSkeleton />
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
                onPress={() => loadNextPage(true)}
                variant="soft"
                textTone="primary"
                rounded="full"
                size="sm"
              />
            </View>
          ) : shouldShowEndMessage ? (
            <EndOfListMessage description="You've seen every Community review." />
          ) : null
        }
        contentContainerStyle={{ paddingBottom: bottomSpacing }}
        onScrollBeginDrag={() => {
          isPaginationArmedRef.current = true;
        }}
        onEndReached={() => loadNextPage(false)}
        onEndReachedThreshold={0.35}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            testID="community-refresh-control"
            refreshing={community.isRefreshing}
            onRefresh={() => void community.refresh()}
            tintColor={theme.extends.colors.brand}
          />
        }
      />
      <CommunityFilterBottomSheet
        sheetRef={filterSheetRef}
        filters={filters}
        options={taxonomy.options}
        isLoading={taxonomy.isLoading}
        error={taxonomy.error}
        onRetry={() => void taxonomy.refetch()}
        onApply={applyFilters}
      />
    </View>
  );
}
