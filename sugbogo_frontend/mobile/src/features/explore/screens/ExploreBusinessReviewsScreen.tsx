import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useEffect, useRef, useState } from "react";
import { useNavigation, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RefreshControl, ScrollView, Text, View } from "react-native";

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
 * on community experiences. Review management is handled through a bottom
 * sheet and the fixed footer provides the primary review action.
 */
export default function ExploreBusinessReviewsScreen({
  businessId,
  businessName = "Business",
  isOwnBusiness = false,
}: Props) {
  const { reviews, isLoading, isRefetching, error, refetch, totalCount } =
    useBusinessReviews(businessId);

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

  if (isLoading) {
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
        contentContainerClassName="gap-3 px-4 pb-32 pt-5"
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
            <Text className="mb-3 text-base font-bold text-text-primary">
              My Review
            </Text>

            <BusinessReviewCard
              businessId={businessId}
              review={myReview}
              onEdit={editReview}
            />
          </View>
        )}

        {/* Community reviews */}
        {communityReviews.length > 0 && (
          <View className={myReview ? "mt-3" : ""}>
            <Text className="mb-3 text-base font-bold text-text-primary">
              Community Reviews
            </Text>

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
          <View className="mt-10 rounded-card bg-surface-secondary p-5">
            <Text className="text-center text-text-secondary">
              No reviews yet. Be the first to share your experience.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Fixed action footer */}
      <BusinessProfileFooter
        isOwnBusiness={isOwnBusiness}
        hasOwnReview={hasOwnReview}
        onGetDirections={() => {}}
        onWriteReview={() => {
          setEditingReview(null);
          presentBottomSheet(reviewSheetRef);
        }}
      />

      {/* Review composer */}
      <ReviewComposerSheet
        businessId={businessId}
        sheetRef={reviewSheetRef}
        review={editingReview}
      />
    </View>
  );
}
