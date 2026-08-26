import { router } from "expo-router";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, Text, View } from "react-native";

import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";
import { useAllBusinessReviews } from "../hooks/useBusinessReviews";
import BusinessReviewCard from "../components/business-profile/BusinessReviewCard";
import ReviewComposerSheet from "../components/business-profile/ReviewComposerSheet";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import type { BusinessReview } from "../types/review.types";

type Props = { businessId: number; businessName?: string };

/** Presents the complete, independently fetched collection of reviews for a business. */
export default function ExploreBusinessReviewsScreen({
  businessId,
  businessName = "Business",
}: Props) {
  const { reviews, isLoading, error, refetch } = useAllBusinessReviews(businessId);
  const reviewSheetRef = useRef<BottomSheetModal | null>(null);
  const [editingReview, setEditingReview] = useState<BusinessReview | null>(null);
  const editReview = (review: BusinessReview) => { setEditingReview(review); presentBottomSheet(reviewSheetRef); };
  const hasOwnReview = reviews.some((review) => review.is_own_review);
  if (isLoading)
    return (
      <LoadingScreen
        title="Loading reviews"
        description="Fetching community feedback..."
      />
    );
  if (error)
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <ErrorState
          title="Unable to load reviews"
          description="We couldn't load reviews right now."
          primaryActionTitle="Retry"
          onPrimaryAction={() => refetch()}
          secondaryActionTitle="Go Back"
          onSecondaryAction={() => router.back()}
        />
      </SafeAreaView>
    );
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface">
      <ScrollView contentContainerClassName="gap-3 px-4 pb-8 pt-5">
        <View className="mb-1 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-text-primary">
              Reviews
            </Text>
            <Text className="mt-1 text-sm text-text-secondary">
              {reviews.length} community review{reviews.length === 1 ? "" : "s"}
            </Text>
          </View>
          {!hasOwnReview && <Button
              title="Write a review"
              onPress={() => { setEditingReview(null); presentBottomSheet(reviewSheetRef); }}
              className="py-3"
            />}
        </View>
        {reviews.length === 0 ? (
          <View className="mt-10 rounded-card bg-surface-secondary p-5">
            <Text className="text-center text-text-secondary">
              No reviews yet. Be the first to share your experience.
            </Text>
          </View>
        ) : (
          reviews.map((review) => (
            <BusinessReviewCard
              key={review.id}
              businessId={businessId}
              businessName={businessName}
              review={review}
              onEdit={editReview}
            />
          ))
        )}
      </ScrollView>
      <ReviewComposerSheet businessId={businessId} sheetRef={reviewSheetRef} review={editingReview} />
    </SafeAreaView>
  );
}
