import MerchantScreenHeader from "../../layout/MerchantScreenHeader";
import Button from "@/shared/components/Button";
import NotificationBellButton from "@/features/notifications/components/NotificationBellButton";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import LottieView from "lottie-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useIsFocused } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import useMerchantReviewFeed from "../../hooks/review-management/useMerchantReviewFeed";
import useMerchantReviewSelection from "../../hooks/review-management/useMerchantReviewSelection";
import useMerchantReviewFocus from "../../hooks/review-management/useMerchantReviewFocus";
import SafePressable from "@/shared/components/SafePressable";
import useMerchantUnansweredReviews from "../../hooks/analytics/useMerchantUnansweredReviews";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import { useReplyTemplates } from "../../hooks/reply-templates/useReplyTemplates";

import type { BusinessReview } from "@/features/explore/types/review.types";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import { useReviewDisputes } from "../../hooks/review-disputes/useReviewDisputes";
import MerchantReviewCard from "../../components/review-management/MerchantReviewCard";
import MerchantReviewFilters from "../../components/review-management/MerchantReviewFilters";
import MerchantReviewManagement from "../../components/review-management/MerchantReviewManagement";
import MerchantReviewReplyComposerSheet from "../../components/review-management/MerchantReviewReplyComposerSheet";
import MerchantReviewsOverview from "../../components/review-management/MerchantReviewsOverview";
import MerchantReviewsSectionSkeleton from "../../components/review-management/MerchantReviewsSectionSkeleton";
import MerchantReviewsSkeleton from "../../components/review-management/MerchantReviewsSkeleton";
import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";

const TAB_BAR_HEIGHT = 64;

const MASCOT_EMPTY_REVIEWS = require("@/shared/assets/mascot/mascot-empty-reviews.webp");

const MASCOT_ALL_CAUGHT_UP = require("@/shared/assets/mascot/mascot-all-caught-up.webp");

const MASCOT_NO_HISTORY = require("@/shared/assets/mascot/mascot-no-history.webp");

/**
 * Gives merchants a focused workspace for explorer reviews and public replies.
 *
 * Keeps page-level management available during review-feed failures and uses
 * localized loading and recovery states when only the review data is affected.
 * Uses lightweight WebP mascot assets for meaningful empty review experiences.
 */
export default function MerchantReviewsScreen() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const {
    filter,
    ordering,
    reviewId,
    entry,
    contentFilters,
    setSelection,
    clearFilters,
  } = useMerchantReviewSelection();
  const unanswered = useMerchantUnansweredReviews(focused);
  useQueryErrorNotification({
    error: focused ? unanswered.error : null,
    toastId: "merchant-review-backlog-error",
    title: "Unable to refresh reviews needing replies",
    fallbackMessage: "Your review list is still available.",
  });

  const {
    business,
    isLoading: isBusinessLoading,
    error: businessError,
    refetch: refetchBusiness,
  } = useMerchantBusinessProfile();

  const businessId = business?.id ?? 0;
  const reviewFocus = useMerchantReviewFocus(
    businessId,
    reviewId,
    entry,
    focused,
  );
  const locatingReview = !!reviewId && reviewFocus.isPending;

  const {
    reviews,
    totalCount,
    isInitialLoading: isReviewsInitialLoading,
    isRefetching,
    error: reviewsError,
    refetch: refetchReviews,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    hasPreviousPage,
    fetchPreviousPage,
    isFetchingPreviousPage,
    isFetchPreviousPageError,
  } = useMerchantReviewFeed(
    businessId,
    filter,
    ordering,
    focused && !locatingReview,
    reviewId ? reviewFocus.data : undefined,
    contentFilters,
  );

  const feedRef = useRef<FlatList<BusinessReview>>(null);
  const handledEntry = useRef<number | null>(null);
  const retryScroll = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollAttempts = useRef({ entry: -1, count: 0 });
  const [finishedHighlight, setFinishedHighlight] = useState<number | null>(
    null,
  );
  const targetIndex = reviewId
    ? reviews.findIndex((review) => review.id === reviewId)
    : -1;
  const targetFound = targetIndex >= 0 && !!reviewFocus.data && !locatingReview;

  useEffect(() => {
    if (!focused || !targetFound || handledEntry.current === entry) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      feedRef.current?.scrollToIndex({
        index: targetIndex,
        animated: false,
        viewPosition: 0.15,
      });
      handledEntry.current = entry;
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [entry, focused, targetFound, targetIndex]);

  useEffect(() => {
    if (!focused || !targetFound) {
      return;
    }
    const highlightTimer = setTimeout(() => setFinishedHighlight(entry), 4000);
    return () => {
      clearTimeout(highlightTimer);
    };
  }, [entry, focused, targetFound]);

  useEffect(() => {
    return () => {
      if (retryScroll.current !== null) {
        clearTimeout(retryScroll.current);
      }
    };
  }, [entry, reviewId, focused]);

  const { disputes, isLoading: isDisputesLoading } = useReviewDisputes();

  const pendingDisputeCount = useMemo(
    () => disputes.filter((dispute) => dispute.status === "pending").length,
    [disputes],
  );

  const { templates, isLoading: isReplyTemplatesLoading } = useReplyTemplates();

  const quickResponseCount = templates.length;

  const replySheetRef = useRef<BottomSheetModal | null>(null);

  const [selectedReview, setSelectedReview] = useState<BusinessReview | null>(
    null,
  );

  const isInitialLoading = isBusinessLoading;
  const sectionLoading = isReviewsInitialLoading || locatingReview;
  const needsReplyCount = unanswered.data?.total_unanswered;
  const hasContentFilters = !!(
    contentFilters.sentiment ||
    contentFilters.topic ||
    contentFilters.hasPhotos
  );

  useQueryErrorNotification({
    error: focused ? reviewsError : null,
    toastId: "merchant-reviews-feed-error",
    title: "Unable to load reviews",
    fallbackMessage: "Please try again.",
  });
  useQueryErrorNotification({
    error: focused ? businessError : null,
    toastId: "merchant-reviews-business-error",
    title: "Unable to load business",
    fallbackMessage: "Please try again.",
  });

  const refresh = async () => {
    if (business) {
      await Promise.all([
        refetchBusiness(),
        refetchReviews(),
        unanswered.refetch(),
      ]);
      return;
    }

    await refetchBusiness();
  };

  const retryBusiness = () => {
    void refetchBusiness();
  };

  const retryReviewLocation = async () => {
    const result = await reviewFocus.refetch();
    if (result.data?.page === reviewFocus.data?.page) {
      await refetchReviews();
    }
  };

  const openReplyComposer = (review: BusinessReview) => {
    setSelectedReview(review);
    presentBottomSheet(replySheetRef);
  };

  const screenHeader = (
    <MerchantScreenHeader
      title="Reviews"
      subtitle={business?.business_name}
      leadingIcon="storefront-outline"
      coverPhotoUrl={business?.display_cover_photo_url}
      compact
      rightAccessory={<NotificationBellButton />}
    />
  );

  if (isInitialLoading) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        className="flex-1 bg-background"
      >
        {screenHeader}
        <MerchantReviewsSkeleton />
      </SafeAreaView>
    );
  }

  if (businessError || !business) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        className="flex-1 bg-surface"
      >
        {screenHeader}
        {/* Business-context error */}
        <ErrorState
          icon="store-alert-outline"
          title="Unable to load reviews"
          description="We couldn't load your business information right now. Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={retryBusiness}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-surface"
    >
      {screenHeader}
      {/* Review feed */}
      <FlatList
        ref={feedRef}
        testID="merchant-reviews-feed"
        data={reviews}
        onEndReached={() => {
          if (
            focused &&
            hasNextPage &&
            !isRefetching &&
            !isFetchingNextPage &&
            !isFetchingPreviousPage &&
            !isFetchNextPageError
          )
            void fetchNextPage();
        }}
        onEndReachedThreshold={0.35}
        keyExtractor={(review) => String(review.id)}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          if (!focused || !reviewId || index >= reviews.length) {
            return;
          }
          if (scrollAttempts.current.entry !== entry) {
            scrollAttempts.current = { entry, count: 0 };
          }
          if (scrollAttempts.current.count >= 3) {
            return;
          }
          scrollAttempts.current.count += 1;
          feedRef.current?.scrollToOffset({
            offset: averageItemLength * index,
            animated: false,
          });
          if (retryScroll.current !== null) {
            clearTimeout(retryScroll.current);
          }
          retryScroll.current = setTimeout(() => {
            feedRef.current?.scrollToIndex({
              index,
              animated: false,
              viewPosition: 0.15,
            });
          }, 150);
        }}
        renderItem={({ item }) => (
          <MerchantReviewCard
            businessId={business.id}
            review={item}
            onReply={openReplyComposer}
            highlighted={item.id === reviewId && finishedHighlight !== entry}
            highlightedTopic={contentFilters.topic}
          />
        )}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || unanswered.isRefetching}
            onRefresh={refresh}
            tintColor={theme.extends.colors.brand}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Review overview */}
            <MerchantReviewsOverview
              totalCount={totalCount}
              filtered={filter !== "all" || hasContentFilters}
              needsReplyCount={needsReplyCount}
            />
            {unanswered.error && (
              <ErrorState
                size="section"
                title="Reply count unavailable"
                description={
                  unanswered.data
                    ? "Previously loaded reply counts are shown."
                    : "Your reviews can still be managed below."
                }
                primaryActionTitle="Retry"
                onPrimaryAction={() => {
                  void unanswered.refetch();
                }}
              />
            )}

            {/* Review management */}
            <MerchantReviewManagement
              pendingDisputeCount={
                isDisputesLoading ? undefined : pendingDisputeCount
              }
              quickResponseCount={
                isReplyTemplatesLoading ? undefined : quickResponseCount
              }
            />

            {/* Review feed controls */}
            <MerchantReviewFilters
              businessId={business.id}
              contentFilters={contentFilters}
              onSelectionChange={setSelection}
              needsReplyCount={needsReplyCount}
              filter={filter}
              ordering={ordering}
            />

            {!!reviewId && reviewFocus.error && (
              <ErrorState
                size="section"
                title="Unable to open this review"
                description="It may no longer be available. You can still browse your reviews below."
                primaryActionTitle="Try again"
                onPrimaryAction={() => void retryReviewLocation()}
              />
            )}

            {!!reviewId &&
              reviewFocus.data &&
              !sectionLoading &&
              !reviewsError &&
              targetIndex < 0 && (
                <ErrorState
                  size="section"
                  title="Review no longer on this page"
                  description="The review list may have changed. Locate it again to continue."
                  primaryActionTitle="Locate review"
                  onPrimaryAction={() => void retryReviewLocation()}
                />
              )}

            {hasPreviousPage && (
              <SafePressable
                accessibilityRole="button"
                accessibilityLabel="Load newer reviews"
                accessibilityState={{
                  disabled:
                    isFetchingPreviousPage ||
                    isRefetching ||
                    isFetchingNextPage,
                  busy: isFetchingPreviousPage,
                }}
                disabled={
                  isFetchingPreviousPage || isRefetching || isFetchingNextPage
                }
                onPress={() => void fetchPreviousPage()}
                className="mt-3 min-h-12 items-center justify-center rounded-btn border border-border-primary px-4 py-3 active:opacity-70"
              >
                <AppText weight="semibold" className="text-sm text-brand">
                  {isFetchingPreviousPage
                    ? "Loading newer reviews…"
                    : isFetchPreviousPageError
                      ? "Retry loading newer reviews"
                      : "Load newer reviews"}
                </AppText>
              </SafePressable>
            )}

            {/* Review retry loading */}
            {sectionLoading && (
              <View className="-mx-4 mt-6 border-t border-border-primary bg-surface px-4 pb-4 pt-6">
                <MerchantReviewsSectionSkeleton />
              </View>
            )}

            {/* Review feed error */}
            {reviewsError && !isFetchNextPageError && (
              <View className="-mx-4 mt-6 border-t border-border-primary bg-surface px-4 pb-4 pt-6">
                <ErrorState
                  size="section"
                  icon="comment-off-outline"
                  title={
                    reviews.length
                      ? "Unable to refresh reviews"
                      : "Unable to load reviews"
                  }
                  description={
                    reviews.length
                      ? "Previously loaded reviews are still shown."
                      : "We couldn't load your reviews right now."
                  }
                  primaryActionTitle="Retry"
                  onPrimaryAction={() => {
                    if (reviewId && reviewFocus.data) {
                      void retryReviewLocation();
                    } else {
                      void refetchReviews();
                    }
                  }}
                />
              </View>
            )}
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View
              className="items-center py-5"
              accessibilityLabel="Loading more reviews"
              accessibilityState={{ busy: true }}
            >
              <LottieView
                source={loadingAnimation}
                autoPlay
                loop
                style={{ width: 50, height: 50 }}
              />
            </View>
          ) : isFetchNextPageError ? (
            <ErrorState
              size="section"
              title="Unable to load more reviews"
              description="Loaded reviews are still available."
              primaryActionTitle="Retry"
              onPrimaryAction={() => {
                void fetchNextPage();
              }}
            />
          ) : !hasNextPage && reviews.length > 0 ? (
            <EndOfListMessage
              title="End of reviews"
              description="You've reached the end of this list."
            />
          ) : null
        }
        ListEmptyComponent={
          reviewsError || sectionLoading ? null : hasContentFilters ? (
            <View className="items-center bg-surface px-6 py-8">
              <AppText
                weight="bold"
                className="text-center text-base text-text-primary"
              >
                No matching reviews
              </AppText>
              <AppText className="mt-1 text-center text-sm leading-5 text-text-secondary">
                Try removing a filter to see more reviews. Your reply-status
                selection may also limit the results.
              </AppText>
              <Button
                title="Clear filters"
                variant="outline"
                size="sm"
                className="mt-4"
                onPress={clearFilters}
                accessibilityLabel="Clear filters to show all reviews"
              />
            </View>
          ) : (
            <>
              {/* No reviews yet */}
              {filter === "all" && (
                <View className="items-center  px-6 py-10">
                  <Image
                    source={MASCOT_EMPTY_REVIEWS}
                    style={{ width: 120, height: 120 }}
                    contentFit="contain"
                  />

                  <AppText
                    weight="bold"
                    className="mt-3 text-center text-base text-text-primary"
                  >
                    No reviews yet
                  </AppText>

                  <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
                    Reviews shared by explorers will appear here.
                  </AppText>
                </View>
              )}

              {/* Needs-reply empty state */}
              {filter === "needs-reply" && (
                <View className="items-center bg-surface px-6 py-8">
                  <Image
                    source={MASCOT_ALL_CAUGHT_UP}
                    style={{ width: 120, height: 120 }}
                    contentFit="contain"
                  />

                  <AppText
                    weight="bold"
                    className="mt-2 text-center text-base text-text-primary"
                  >
                    All caught up
                  </AppText>

                  <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
                    No reviews need your reply. Check back later for new
                    feedback from explorers.
                  </AppText>
                </View>
              )}

              {/* Replied-filter empty state */}
              {filter === "replied" && (
                <View className="items-center bg-surface px-6 py-8">
                  <Image
                    source={MASCOT_NO_HISTORY}
                    style={{ width: 120, height: 120 }}
                    contentFit="contain"
                  />

                  <AppText
                    weight="bold"
                    className="mt-2 text-center text-base text-text-primary"
                  >
                    No replied reviews yet
                  </AppText>

                  <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
                    Reviews you reply to will appear here.
                  </AppText>
                </View>
              )}
            </>
          )
        }
      />

      {/* Reply composer */}
      <MerchantReviewReplyComposerSheet
        businessId={business.id}
        review={selectedReview}
        sheetRef={replySheetRef}
        onDismiss={() => setSelectedReview(null)}
      />
    </SafeAreaView>
  );
}
