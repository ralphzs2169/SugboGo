import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useEffect, useRef, useState } from "react";
import { useNavigation, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RefreshControl, ScrollView, View } from "react-native";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import { useBusinessReviews } from "../hooks/useBusinessReviews";
import BusinessReviewCard from "../components/business-profile/review-section/BusinessReviewCard";
import ReviewComposerSheet from "../components/business-profile/ReviewComposerSheet";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import type { BusinessReview } from "../types/review.types";
import { theme } from "@/constants/theme";
import BusinessReviewsSkeleton from "../components/business-profile/state/BusinessReviewsSkeleton";
import BusinessProfileFooter from "../components/business-profile/BusinessProfileFooter";

type Props = {
  businessId: number;
  businessName?: string;
  isOwnBusiness: boolean;
};

/**
 * Presents the complete collection of reviews for a business.
 *
 * Separates the current user's review from community reviews so their own
 * review is immediately accessible while keeping the remaining reviews focused
 * on community experiences. Eligible Explorers can open the existing review
 * composer from an inline action, while owners retain their management footer.
 */
export default function ExploreBusinessReviewsScreen({
  businessId,
  businessName = "Business",
  isOwnBusiness = false,
}: Props) {
  const {
    reviews,
    isInitialLoading,
    isRefetching,
    error,
    refetch,
    totalCount,
  } = useBusinessReviews(businessId);

  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    navigation.setOptions({
      title: `Reviews (${totalCount})`,
    });
  }, [navigation, totalCount]);

  const reviewSheetRef = useRef<BottomSheetModal | null>(null);

  const [editingReview, setEditingReview] = useState<BusinessReview | null>(
    null,
  );

  const editReview = (review: BusinessReview) => {
    setEditingReview(review);
    presentBottomSheet(reviewSheetRef);
  };

  const myReview = reviews.find((review) => review.is_own_review);
  const communityReviews = reviews.filter((review) => !review.is_own_review);
  const hasOwnReview = Boolean(myReview);
  const canWriteReview = !isOwnBusiness && !hasOwnReview;

  const createReview = () => {
    setEditingReview(null);
    presentBottomSheet(reviewSheetRef);
  };

  if (isInitialLoading) {
    return <BusinessReviewsSkeleton bottomInset={insets.bottom} />;
  }

  if (error) {
    return (
      <View className="flex-1 bg-surface">
        <ErrorState
          size="small"
          icon="comment-off-outline"
          title="Unable to load reviews"
          description="We couldn't load the reviews right now. Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={refetch}
          secondaryActionTitle="Go Back"
          onSecondaryAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {/* Review list */}
      <ScrollView
        contentContainerClassName={`gap-3 px-4 pt-5 ${
          isOwnBusiness ? "pb-32" : "pb-8"
        }`}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.extends.colors.brand}
          />
        }
      >
        {/* My review */}
        {myReview && (
          <View>
            <AppText weight="bold" className="mb-3 text-base text-text-primary">
              My Review
            </AppText>

            <BusinessReviewCard
              businessId={businessId}
              review={myReview}
              onEdit={editReview}
            />
          </View>
        )}

        {/* Inline review action */}
        {canWriteReview && communityReviews.length > 0 && (
          <Button
            title="Write a review"
            onPress={createReview}
            rounded="full"
            className="mb-2 py-3"
            fontClassName="text-sm"
          />
        )}

        {/* Community reviews */}
        {communityReviews.length > 0 && (
          <View className={myReview ? "mt-3" : ""}>
            <AppText weight="bold" className="mb-3 text-base text-text-primary">
              Community Reviews
            </AppText>

            <View className="gap-3">
              {communityReviews.map((review) => (
                <BusinessReviewCard
                  key={review.id}
                  businessId={businessId}
                  review={review}
                  onEdit={editReview}
                />
              ))}
            </View>
          </View>
        )}

        {/* Empty state */}
        {!myReview && communityReviews.length === 0 && (
          <View className="mt-10 items-center rounded-card bg-surface-secondary p-5">
            <AppText
              weight="semibold"
              className="text-center text-text-primary"
            >
              No reviews yet
            </AppText>
            <AppText className="mt-1 text-center text-text-secondary">
              {isOwnBusiness
                ? "Reviews from Explorers will show up here."
                : "Be the first to share your experience."}
            </AppText>

            {canWriteReview && (
              <Button
                title="Write a review"
                onPress={createReview}
                rounded="full"
                className="mt-5 min-w-44 py-3"
                fontClassName="text-sm"
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* Owner management action */}
      {isOwnBusiness && <BusinessProfileFooter isOwnBusiness />}

      {/* Review composer */}
      <ReviewComposerSheet
        businessId={businessId}
        sheetRef={reviewSheetRef}
        review={editingReview}
      />
    </View>
  );
}
