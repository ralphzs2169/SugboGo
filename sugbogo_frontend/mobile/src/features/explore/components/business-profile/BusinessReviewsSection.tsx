import { router } from "expo-router";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";

import useBusinessReviews from "../../hooks/useBusinessReviews";
import BusinessReviewCard from "./BusinessReviewCard";
import ReviewComposerSheet from "./ReviewComposerSheet";
import type { BusinessReview } from "../../types/review.types";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

type Props = {
  businessId: number;
  businessName: string;
};

/**
 * Displays a compact preview of the business's latest reviews.
 *
 * The preview endpoint is already limited to three reviews, while the
 * dedicated reviews screen handles the complete review list.
 */
export default function BusinessReviewsSection({
  businessId,
  businessName,
}: Props) {
  const { reviews, isLoading, error, refetch, totalCount } =
    useBusinessReviews(businessId);
  const composerRef = useRef<BottomSheetModal | null>(null);
  const [editingReview, setEditingReview] = useState<BusinessReview | null>(
    null,
  );
  const editReview = (review: BusinessReview) => {
    setEditingReview(review);
    presentBottomSheet(composerRef);
  };
  const createReview = () => {
    setEditingReview(null);
    presentBottomSheet(composerRef);
  };
  const hasOwnReview = reviews.some((review) => review.is_own_review);

  const openReviews = () => {
    router.push({
      pathname: "/(explorer)/business/[businessId]/reviews",
      params: {
        businessId: String(businessId),
      },
    });
  };

  return (
    <View className="mt-6 border-t border-border-primary px-4 pt-5">
      {/* Section heading */}
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-text-primary">
          Reviews {totalCount > 0 ? `(${totalCount})` : ""}
        </Text>

        {!isLoading && !error && totalCount > 0 && (
          <Pressable
            onPress={openReviews}
            className="cursor-pointer active:opacity-70"
          >
            <Text className="font-semibold text-brand">See all reviews</Text>
          </Pressable>
        )}
      </View>

      {/* Loading state */}
      {isLoading && (
        <Text className="mt-3 text-sm text-text-secondary">
          Loading reviews…
        </Text>
      )}

      {/* Error state */}
      {error && (
        <View className="h-48">
          <ErrorState
            title="Unable to load reviews"
            description="Please try again."
            primaryActionTitle="Retry"
            onPrimaryAction={refetch}
          />
        </View>
      )}

      {/* Empty state */}
      {!isLoading && !error && totalCount === 0 && !hasOwnReview && (
        <View className="mt-3 rounded-card bg-surface-secondary p-4">
          <Text className="text-sm text-text-secondary">
            No reviews yet. Be the first to share your experience.
          </Text>

          <Button
            title="Write a review"
            onPress={createReview}
            className="mt-3"
          />
        </View>
      )}

      {/* Review creation action */}
      {!isLoading && !error && totalCount > 0 && !hasOwnReview && (
        <Button
          title="Write a review"
          onPress={createReview}
          className="mt-3"
        />
      )}

      {/* Review preview */}
      {!isLoading && !error && reviews.length > 0 && (
        <View className="mt-3 gap-3">
          {reviews.map((review) => (
            <BusinessReviewCard
              key={review.id}
              businessId={businessId}
              businessName={businessName}
              review={review}
              onEdit={editReview}
            />
          ))}
        </View>
      )}
      <ReviewComposerSheet
        businessId={businessId}
        sheetRef={composerRef}
        review={editingReview}
      />
    </View>
  );
}
