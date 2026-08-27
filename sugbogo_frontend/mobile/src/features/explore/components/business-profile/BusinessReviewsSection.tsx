import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { theme } from "@/constants/theme";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";

import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import useBusinessReviews from "../../hooks/useBusinessReviews";
import type { BusinessReview } from "../../types/review.types";
import BusinessReviewCard from "./BusinessReviewCard";
import ReviewComposerSheet from "./ReviewComposerSheet";

type Props = {
  businessId: number;
  businessName: string;
};

/**
 * Displays a compact preview of the business's latest reviews.
 *
 * The preview endpoint is limited to three reviews, while the dedicated
 * reviews screen handles the complete review list and editing workflow.
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

  const hasOwnReview = reviews.some((review) => review.is_own_review);

  const editReview = (review: BusinessReview) => {
    setEditingReview(review);
    presentBottomSheet(composerRef);
  };

  const createReview = () => {
    setEditingReview(null);
    presentBottomSheet(composerRef);
  };

  const openReviews = () => {
    router.push({
      pathname: "/(explorer)/business/[businessId]/reviews",
      params: {
        businessId: String(businessId),
      },
    });
  };

  return (
    <View>
      {/* Reviews heading */}
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-base font-bold text-text-primary">
          Reviews {totalCount > 0 ? `(${totalCount})` : ""}
        </Text>

        {!isLoading && !error && (
          <>
            {totalCount > 0 ? (
              <Pressable
                onPress={openReviews}
                className="cursor-pointer flex-row items-center active:opacity-70"
              >
                <Text className="text-sm font-semibold text-brand">
                  See all
                </Text>

                <MaterialCommunityIcons
                  name="chevron-right"
                  size={16}
                  color={theme.extends.colors.brand}
                />
              </Pressable>
            ) : (
              <MaterialCommunityIcons
                name="message-text-outline"
                size={20}
                color={theme.extends.colors.text.secondary}
              />
            )}
          </>
        )}
      </View>

      {/* Loading state */}
      {isLoading && (
        <Text className="text-sm text-text-secondary">Loading reviews…</Text>
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
        <View className="items-center border-t border-border-primary px-4 py-8">
          <Text className="mt-2 text-sm font-semibold text-text-primary">
            No reviews yet
          </Text>

          <Text className="mt-1 text-center text-xs text-text-secondary">
            Be the first to share your experience.
          </Text>

          <Button
            title="Write a review"
            onPress={createReview}
            icon={
              <MaterialCommunityIcons
                name="comment-edit-outline"
                size={18}
                color="white"
              />
            }
            rounded="full"
            className="mt-5"
            fontClassName="text-sm font-semibold"
          />
        </View>
      )}

      {/* Review preview */}
      {!isLoading && !error && reviews.length > 0 && (
        <View className="border-t border-border-primary">
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

      {/* Review creation action */}
      {!isLoading && !error && totalCount > 0 && !hasOwnReview && (
        <View className="items-center pt-5">
          <Button
            title="Write a review"
            onPress={createReview}
            icon={
              <MaterialCommunityIcons
                name="comment-edit-outline"
                size={18}
                color="white"
              />
            }
            rounded="full"
            fontClassName="text-sm font-semibold"
            className="px-8"
          />
        </View>
      )}
      {/* Review composer */}
      <ReviewComposerSheet
        businessId={businessId}
        sheetRef={composerRef}
        review={editingReview}
      />
    </View>
  );
}
