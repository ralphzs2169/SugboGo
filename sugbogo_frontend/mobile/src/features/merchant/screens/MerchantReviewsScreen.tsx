import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import type { BusinessReview } from "@/features/explore/types/review.types";
import { useBusinessReviews } from "@/features/explore/hooks/useBusinessReviews";
import { theme } from "@/constants/theme";
import ErrorState from "@/shared/components/ErrorState";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import useMerchantBusinessProfile from "../hooks/business-profile/useMerchantBusinessProfile";
import MerchantReviewCard from "../components/reviews/MerchantReviewCard";
import MerchantReviewReplyComposerSheet from "../components/reviews/MerchantReviewReplyComposerSheet";
import MerchantReviewsSkeleton from "../components/reviews/MerchantReviewsSkeleton";

type ReviewFilter = "all" | "needs-reply" | "replied";

const FILTERS: {
  label: string;
  value: ReviewFilter;
}[] = [
  {
    label: "All",
    value: "all",
  },
  {
    label: "Needs reply",
    value: "needs-reply",
  },
  {
    label: "Replied",
    value: "replied",
  },
];

/**
 * Gives merchants a focused inbox for customer feedback and public replies.
 *
 * Reply filters are intentionally derived from the complete loaded review set;
 * the current review API has no filter parameters and the labels never imply
 * server-side filtering.
 */
export default function MerchantReviewsScreen() {
  const { business, isLoading: isBusinessLoading, error: businessError, refetch: refetchBusiness } =
    useMerchantBusinessProfile();

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

  const isLoading = isBusinessLoading || (Boolean(business) && isReviewsLoading);
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
      await Promise.all([
        refetchBusiness(),
        refetchReviews(),
      ]);
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
      <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
        <MerchantReviewsSkeleton />
      </SafeAreaView>
    );
  }

  if (error || !business) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
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

  const needsReplyCount = reviews.filter((review) => !review.reply).length;

  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-background">
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
        contentContainerClassName="px-4 pb-8"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refresh}
            tintColor={theme.extends.colors.brand}
          />
        }
        ListHeaderComponent={
          <View className="pb-5 pt-4">
            <Text className="text-2xl font-bold text-text-primary">Reviews</Text>
            <Text className="mt-1 text-sm text-text-secondary">
              {totalCount === 1
                ? "1 customer review"
                : `${totalCount} customer reviews`}
            </Text>

            {needsReplyCount > 0 && (
              <View className="mt-4 flex-row items-center rounded-card bg-brand/10 px-3 py-3">
                <MaterialCommunityIcons
                  name="reply-outline"
                  size={20}
                  color={theme.extends.colors.brand}
                />
                <Text className="ml-2 flex-1 text-sm font-medium text-text-primary">
                  {needsReplyCount === 1
                    ? "1 review is waiting for your response."
                    : `${needsReplyCount} reviews are waiting for your response.`}
                </Text>
              </View>
            )}

            <View className="mt-4 flex-row gap-2">
              {FILTERS.map((item) => {
                const isSelected = filter === item.value;

                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setFilter(item.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    className={`min-h-11 justify-center rounded-full px-4 ${
                      isSelected
                        ? "bg-brand"
                        : "border border-border-primary bg-surface"
                    } active:opacity-80`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        isSelected ? "text-white" : "text-text-secondary"
                      }`}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          <View className="items-center rounded-card border border-border-primary bg-surface px-6 py-10">
            <MaterialCommunityIcons
              name={filter === "all" ? "comment-text-outline" : "check-circle-outline"}
              size={38}
              color={theme.extends.colors.text.tertiary}
            />
            <Text className="mt-3 text-base font-bold text-text-primary">
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

      <MerchantReviewReplyComposerSheet
        businessId={business.id}
        review={selectedReview}
        sheetRef={replySheetRef}
        onDismiss={() => setSelectedReview(null)}
      />
    </SafeAreaView>
  );
}
