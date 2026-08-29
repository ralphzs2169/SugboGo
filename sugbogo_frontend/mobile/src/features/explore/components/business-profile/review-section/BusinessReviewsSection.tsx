import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { theme } from "@/constants/theme";
import ErrorState from "@/shared/components/ErrorState";

import { useBusinessReviewPreview } from "../../../hooks/useBusinessReviews";
import type { BusinessReview } from "../../../types/review.types";
import BusinessReviewCard from "./BusinessReviewCard";

type Props = {
  businessId: number;
  businessName: string;
  isOwnBusiness: boolean;
  onEditReview: (review: BusinessReview) => void;
};

/**
 * Displays a compact preview of the business's latest reviews.
 *
 * Uses the preview endpoint, which provides up to three reviews and the
 * total review count. The dedicated reviews screen handles the complete
 * review collection and review management workflow.
 */
export default function BusinessReviewsSection({
  businessId,
  businessName,
  isOwnBusiness,
  onEditReview,
}: Props) {
  const { reviews, isLoading, error, refetch, totalCount, hasOwnReview } =
    useBusinessReviewPreview(businessId);

  const reviewCount = totalCount ?? 0;

  const openReviews = () => {
    router.push({
      pathname: "/(explorer)/business/[businessId]/reviews",
      params: {
        businessId: String(businessId),
        isOwnBusiness: isOwnBusiness ? "1" : "0",
      },
    });
  };

  return (
    <View>
      {/* Reviews heading */}
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-base font-bold text-text-primary">
          Reviews {reviewCount > 0 ? `(${reviewCount})` : ""}
        </Text>

        {!isLoading && !error && (
          <>
            {reviewCount > 0 ? (
              <Pressable
                onPress={openReviews}
                className="cursor-pointer flex-row items-center active:opacity-70"
              >
                <Text className="text-sm font-semibold text-brand">
                  See more
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

      {/* Existing review notice */}
      {!isLoading && !error && hasOwnReview && (
        <View className="mb-4 flex-row items-center bg-info rounded-md  px-3 py-2.5">
          <MaterialCommunityIcons
            name="information-outline"
            size={16}
            color={theme.extends.colors.text.info}
          />

          <Text className="ml-2 flex-1 text-xs text-text-secondary">
            You've already reviewed this business. You can edit your review
            anytime.
          </Text>
        </View>
      )}

      {/* Empty state */}
      {!isLoading && !error && reviewCount === 0 && !hasOwnReview && (
        <View className="items-center border-t border-border-primary px-4 py-8">
          {isOwnBusiness && (
            <MaterialCommunityIcons
              name="comment-text-outline"
              size={32}
              color={theme.extends.colors.text.tertiary}
            />
          )}

          <Text className="mt-2 text-sm font-semibold text-text-primary">
            No reviews yet
          </Text>

          <Text className="mt-1 text-center text-xs text-text-secondary">
            {isOwnBusiness
              ? "Reviews from Explorers will show up here."
              : "Be the first to share your experience."}
          </Text>
        </View>
      )}

      {/* Review preview */}
      {!isLoading && !error && reviews.length > 0 && (
        <View className="pb-4 gap-2">
          {reviews.map((review) => (
            <BusinessReviewCard
              key={review.id}
              businessId={businessId}
              businessName={businessName}
              review={review}
              onEdit={onEditReview}
            />
          ))}
        </View>
      )}

      {/* Review action */}
      {!isLoading &&
        !error &&
        reviewCount === 0 &&
        !hasOwnReview &&
        !isOwnBusiness && (
          <View className="items-center pt-5">
            {/* The fixed footer provides the primary review action. */}
          </View>
        )}
    </View>
  );
}
