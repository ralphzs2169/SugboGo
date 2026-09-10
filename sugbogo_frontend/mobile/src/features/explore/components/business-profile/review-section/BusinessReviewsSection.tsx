import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";

import { useBusinessReviewPreview } from "../../../hooks/useBusinessReviews";
import type { BusinessReview } from "../../../types/review.types";
import BusinessReviewCard from "./BusinessReviewCard";

const MASCOT_EMPTY_REVIEWS = require("@/shared/assets/mascot/mascot-empty-reviews.webp");

type Props = {
  businessId: number;
  businessName: string;
  isOwnBusiness: boolean;
  onEditReview: (review: BusinessReview) => void;
};

/**
 * Displays a compact preview of the business's latest reviews.
 *
 * Uses the preview endpoint, which provides up to three reviews and the total
 * review count. Empty and failure states remain localized to this section.
 * Uses a lightweight SugboGo WebP mascot for the true empty-review state.
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
        <AppText weight="bold" className="text-base text-text-primary">
          Reviews {reviewCount > 0 ? `(${reviewCount})` : ""}
        </AppText>

        {!isLoading && !error && (
          <>
            {reviewCount > 0 ? (
              <Pressable
                onPress={openReviews}
                className="cursor-pointer flex-row items-center active:opacity-70"
              >
                <AppText weight="semibold" className="text-sm text-brand">
                  See more
                </AppText>

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
        <AppText className="text-sm text-text-secondary">
          Loading reviews…
        </AppText>
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
        <View className="mb-4 flex-row items-center rounded-md bg-info px-3 py-2.5">
          <MaterialCommunityIcons
            name="information-outline"
            size={16}
            color={theme.extends.colors.text.info}
          />

          <AppText className="ml-2 flex-1 text-xs text-text-secondary">
            You've already reviewed this business. You can edit your review
            anytime.
          </AppText>
        </View>
      )}

      {/* Empty reviews state */}
      {!isLoading && !error && reviewCount === 0 && !hasOwnReview && (
        <View className="items-center border-t border-border-primary px-4 py-6">
          <Image
            source={MASCOT_EMPTY_REVIEWS}
            style={{ width: 120, height: 120 }}
            contentFit="contain"
          />

          <AppText weight="semibold" className="mt-2 text-sm text-text-primary">
            No reviews yet
          </AppText>

          <AppText className="mt-1 max-w-64 text-center text-xs leading-5 text-text-secondary">
            {isOwnBusiness
              ? "Reviews from Explorers will show up here."
              : "Be the first to share your experience."}
          </AppText>
        </View>
      )}

      {/* Review preview */}
      {!isLoading && !error && reviews.length > 0 && (
        <View className="gap-2 pb-4">
          {reviews.map((review) => (
            <BusinessReviewCard
              key={review.id}
              businessId={businessId}
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
