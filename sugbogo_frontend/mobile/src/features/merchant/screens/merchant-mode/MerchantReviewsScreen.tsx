import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, View, Text } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import type { BusinessReview } from "@/features/explore/types/review.types";
import { useBusinessReviews } from "@/features/explore/hooks/useBusinessReviews";
import { theme } from "@/constants/theme";
import ErrorState from "@/shared/components/ErrorState";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import useMerchantBusinessProfile from "../../hooks/business-profile/useMerchantBusinessProfile";
import MerchantReviewCard from "../../components/review-management/MerchantReviewCard";
import MerchantReviewReplyComposerSheet from "../../components/review-management/MerchantReviewReplyComposerSheet";
import MerchantReviewsHeader from "../../components/review-management/MerchantReviewsHeader";
import MerchantReviewsSkeleton from "../../components/review-management/MerchantReviewsSkeleton";

type ReviewFilter = "all" | "needs-reply" | "replied";

const TAB_BAR_HEIGHT = 64;

/**
 * Gives merchants a focused inbox for customer feedback and public replies.
 *
 * Reply filters are derived from the complete loaded review set because the
 * current review API does not expose server-side filtering parameters.
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
    isLoading: isReviewsLoading,
    isRefetching,
    error: reviewsError,
    refetch: refetchReviews,
  } = useBusinessReviews(businessId);

  const replySheetRef = useRef<BottomSheetModal | null>(null);

  const [selectedReview, setSelectedReview] = useState<BusinessReview | null>(
    null,
  );
  const [filter, setFilter] = useState<ReviewFilter>("all");

  const isLoading =
    isBusinessLoading || (Boolean(business) && isReviewsLoading);

  const error = businessError || reviewsError;

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
    if (!error) {
      return;
    }

    const response = error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: "Unable to load reviews",
        text2: response.message || "Please try again.",
      });
    }
  }, [error]);

  const refresh = async () => {
    if (business) {
      await Promise.all([refetchBusiness(), refetchReviews()]);
      return;
    }

    await refetchBusiness();
  };

  const retry = () => {
    void refresh();
  };

  const openReplyComposer = (review: BusinessReview) => {
    setSelectedReview(review);
    presentBottomSheet(replySheetRef);
  };

  if (isLoading) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        className="flex-1 bg-background"
      >
        <MerchantReviewsSkeleton />
      </SafeAreaView>
    );
  }

  if (error || !business) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        className="flex-1 bg-background"
      >
        <ErrorState
          size="small"
          icon="comment-off-outline"
          title="Unable to load reviews"
          description="We couldn't load your customer reviews right now. Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={retry}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-background"
    >
      {/* Review list */}
      <FlatList
        data={filteredReviews}
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
          <MerchantReviewsHeader
            totalCount={totalCount}
            needsReplyCount={needsReplyCount}
            filter={filter}
            onFilterChange={setFilter}
          />
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          <View className="items-center rounded-card border border-border-primary bg-surface px-6 py-10">
            {/* Empty-state content */}
            <Text className="text-base font-bold text-text-primary">
              {filter === "all" ? "No reviews yet" : "Nothing here"}
            </Text>

            <Text className="mt-1 text-center text-sm leading-5 text-text-secondary">
              {filter === "all"
                ? "Customer feedback will appear here when your business receives reviews."
                : "No reviews match this reply status."}
            </Text>
          </View>
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
