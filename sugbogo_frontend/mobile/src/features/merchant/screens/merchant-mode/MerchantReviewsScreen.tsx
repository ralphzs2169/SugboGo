import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import { useBusinessReviews } from "@/features/explore/hooks/useBusinessReviews";
import { useReplyTemplates } from "../../hooks/reply-templates/useReplyTemplates";

import type { BusinessReview } from "@/features/explore/types/review.types";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import { useReviewDisputes } from "../../hooks/review-disputes/useReviewDisputes";
import MerchantReviewCard from "../../components/review-management/MerchantReviewCard";
import MerchantReviewFilters, {
  type ReviewFilter,
} from "../../components/review-management/MerchantReviewFilters";
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
  } = useBusinessReviews(businessId);

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
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [isRetryingReviews, setIsRetryingReviews] = useState(false);

  const isInitialLoading =
    isBusinessLoading || (Boolean(business) && isReviewsInitialLoading);

  const filteredReviews = useMemo(() => {
    if (filter === "needs-reply") {
      return reviews.filter((review) => !review.reply);
    }

    if (filter === "replied") {
      return reviews.filter((review) => Boolean(review.reply));
    }

    return reviews;
  }, [filter, reviews]);

  const needsReplyCount = useMemo(
    () => reviews.filter((review) => !review.reply).length,
    [reviews],
  );

  useEffect(() => {
    const error = businessError || reviewsError;

    if (!error) {
      return;
    }

    const response = error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: reviewsError
          ? "Unable to load reviews"
          : "Unable to load business",
        text2: response.message || "Please try again.",
      });
    }
  }, [businessError, reviewsError]);

  const refresh = async () => {
    if (business) {
      await Promise.all([refetchBusiness(), refetchReviews()]);
      return;
    }

    await refetchBusiness();
  };

  const retryBusiness = () => {
    void refetchBusiness();
  };

  const retryReviews = async () => {
    setIsRetryingReviews(true);

    try {
      await refetchReviews();
    } finally {
      setIsRetryingReviews(false);
    }
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
        data={reviewsError || isRetryingReviews ? [] : filteredReviews}
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
            refreshing={isRefetching}
            onRefresh={refresh}
            tintColor={theme.extends.colors.brand}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Review overview */}
            <MerchantReviewsOverview
              totalCount={
                reviewsError || isRetryingReviews ? undefined : totalCount
              }
              needsReplyCount={
                reviewsError || isRetryingReviews ? undefined : needsReplyCount
              }
            />

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
            {!reviewsError && !isRetryingReviews && (
              <MerchantReviewFilters
                needsReplyCount={needsReplyCount}
                filter={filter}
                onFilterChange={setFilter}
              />
            )}

            {/* Review retry loading */}
            {isRetryingReviews && (
              <View className="-mx-4 mt-6 border-t border-border-primary bg-surface px-4 pb-4 pt-6">
                <View className="mb-4">
                  <AppText weight="bold" className="text-lg text-text-primary">
                    Reviews
                  </AppText>

                  <AppText className="mt-0.5 text-xs text-text-secondary">
                    Feedback shared by explorers
                  </AppText>
                </View>

                <MerchantReviewsSectionSkeleton />
              </View>
            )}

            {/* Review feed error */}
            {reviewsError && !isRetryingReviews && (
              <View className="-mx-4 mt-6 border-t border-border-primary bg-surface px-4 pb-4 pt-6">
                <View className="mb-4">
                  <AppText weight="bold" className="text-lg text-text-primary">
                    Reviews
                  </AppText>

                  <AppText className="mt-0.5 text-xs text-text-secondary">
                    Feedback shared by explorers
                  </AppText>
                </View>

                <ErrorState
                  size="section"
                  icon="comment-off-outline"
                  title="Unable to load reviews"
                  description="We couldn't load your reviews right now."
                  primaryActionTitle="Retry"
                  onPrimaryAction={() => void retryReviews()}
                />
              </View>
            )}
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          reviewsError || isRetryingReviews ? null : (
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
