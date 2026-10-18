import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import LottieView from "lottie-react-native";
import { useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useIsFocused } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import useMerchantReviewFeed from "../../hooks/review-management/useMerchantReviewFeed";
import useMerchantReviewSelection from "../../hooks/review-management/useMerchantReviewSelection";
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
  const { filter, ordering, setFilter, setOrdering } =
    useMerchantReviewSelection();
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
  } = useMerchantReviewFeed(businessId, filter, ordering, focused);

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
  const sectionLoading = isReviewsInitialLoading;
  const needsReplyCount = unanswered.data?.total_unanswered;

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

  const openReplyComposer = (review: BusinessReview) => {
    setSelectedReview(review);
    presentBottomSheet(replySheetRef);
  };

  if (isInitialLoading) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        className="flex-1 bg-background"
      >
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
      {/* Review feed */}
      <FlatList
        testID="merchant-reviews-feed"
        data={reviews}
        onEndReached={() => {
          if (
            focused &&
            hasNextPage &&
            !isRefetching &&
            !isFetchingNextPage &&
            !isFetchNextPageError
          )
            void fetchNextPage();
        }}
        onEndReachedThreshold={0.35}
        keyExtractor={(review) => String(review.id)}
        renderItem={({ item }) => (
          <MerchantReviewCard
            businessId={business.id}
            review={item}
            onReply={openReplyComposer}
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
              filtered={filter !== "all"}
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
              needsReplyCount={needsReplyCount}
              filter={filter}
              onFilterChange={setFilter}
              ordering={ordering}
              onOrderingChange={setOrdering}
            />

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
                  onPrimaryAction={() => void refetchReviews()}
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
          reviewsError || sectionLoading ? null : (
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
