import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";

import { useBusinessReviewPreview } from "../../../../hooks/useBusinessReviews";
import type { BusinessReviewInsights } from "../../../../types/exploreBusiness.types";
import type { BusinessReview } from "../../../../types/review.types";
import BusinessReviewCardSkeleton from "../../state/BusinessReviewCardSkeleton";
import BusinessReviewCard from "../BusinessReviewCard";
import ReviewInsightsPreview from "./ReviewInsightsPreview";

const MASCOT_EMPTY_REVIEWS = require("@/shared/assets/mascot/mascot-empty-reviews.webp");

type Props = {
  businessId: number;
  businessName: string;
  isOwnBusiness: boolean;
  displayAsExplorer?: boolean;
  hasOwnReview: boolean;
  reviewInsights?: BusinessReviewInsights | null;
  onWriteReview: () => void;
  onEditReview: (review: BusinessReview) => void;
};

/**
 * Displays a compact preview of the business's reviews and recent review insights.
 *
 * Keeps the profile focused on review discovery while placing review creation
 * after the previewed reviews as a secondary section action.
 */
export default function BusinessReviewsPreviewSection({
  businessId,
  isOwnBusiness,
  displayAsExplorer = false,
  hasOwnReview: businessHasOwnReview,
  reviewInsights,
  onWriteReview,
  onEditReview,
}: Props) {
  const {
    reviews,
    isLoading,
    error,
    refetch,
    totalCount,
    hasOwnReview: previewHasOwnReview,
  } = useBusinessReviewPreview(businessId);

  const reviewCount = totalCount ?? 0;
  const hasOwnReview = businessHasOwnReview || previewHasOwnReview;
  const canWriteReview = !isOwnBusiness && !hasOwnReview;

  const openReviews = () => {
    router.push({
      pathname: "/(explorer)/business/[businessId]/reviews",
      params: {
        businessId: String(businessId),
        isOwnBusiness: isOwnBusiness ? "1" : "0",
        ...(displayAsExplorer ? { previewAsExplorer: "1" } : {}),
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

      {/* Compact review insights */}
      <ReviewInsightsPreview insights={reviewInsights} />

      {/* Loading state */}
      {isLoading && <BusinessReviewCardSkeleton />}

      {/* Error state */}
      {error && (
        <View className="h-48">
          <ErrorState
            title="Unable to load reviews"
            description="Please try again."
            primaryActionTitle="Retry"
            onPrimaryAction={refetch}
            size="section"
          />
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
            {isOwnBusiness && !displayAsExplorer
              ? "Reviews from Explorers will show up here."
              : "Be the first to share your experience."}
          </AppText>

          {canWriteReview && (
            <Button
              title="Write a review"
              onPress={onWriteReview}
              rounded="full"
              className="mt-5 min-w-44 cursor-pointer py-3"
              fontClassName="text-sm"
            />
          )}
        </View>
      )}

      {/* Review preview */}
      {!isLoading && !error && reviews.length > 0 && (
        <View>
          {/* Latest reviews */}
          <View className="gap-2 pb-4">
            {reviews.map((review, index) => (
              <BusinessReviewCard
                key={review.id}
                businessId={businessId}
                review={review}
                isLast={index === reviews.length - 1}
                onEdit={onEditReview}
              />
            ))}
          </View>

          {/* Review creation action */}
          {canWriteReview && (
            <View className="items-center">
              <Button
                title="Write a review"
                onPress={onWriteReview}
                variant="soft"
                rounded="full"
                size="sm"
                className="min-w-40 cursor-pointer py-2.5"
                fontClassName="text-sm"
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}
