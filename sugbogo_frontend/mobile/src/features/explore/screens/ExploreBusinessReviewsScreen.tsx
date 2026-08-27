import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useEffect, useRef, useState } from "react";
import { useNavigation, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import Button from "@/shared/components/Button";
import ErrorState from "@/shared/components/ErrorState";
import LoadingScreen from "@/shared/components/LoadingScreen";
import { useAllBusinessReviews } from "../hooks/useBusinessReviews";
import BusinessReviewCard from "../components/business-profile/BusinessReviewCard";
import ReviewComposerSheet from "../components/business-profile/ReviewComposerSheet";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import type { BusinessReview } from "../types/review.types";
import { theme } from "@/constants/theme";
import BusinessReviewsSkeleton from "../components/business-profile/state/BusinessReviewsSkeleton";

type Props = {
  businessId: number;
  businessName?: string;
};

/**
 * Presents the complete collection of reviews for a business.
 *
 * Provides review management through a bottom sheet and a fixed action footer
 * that remains above the device's system navigation area.
 */
export default function ExploreBusinessReviewsScreen({
  businessId,
  businessName = "Business",
}: Props) {
  const { reviews, isLoading, isRefetching, error, refetch, totalCount } =
    useAllBusinessReviews(businessId);

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

  const hasOwnReview = reviews.some((review) => review.is_own_review);

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

      {/* Fixed action footer */}
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-border-primary bg-surface px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <View className="flex-row gap-3">
          <Button
            title="Get directions"
            onPress={() => {}}
            variant="soft"
            icon={
              <MaterialCommunityIcons
                name="navigation-outline"
                size={18}
                color={theme.extends.colors.brand}
              />
            }
            rounded="full"
            className="flex-1"
            fontClassName="text-sm font-semibold"
          />

          {!hasOwnReview && (
            <Button
              title="Write a review"
              onPress={() => {
                setEditingReview(null);
                presentBottomSheet(reviewSheetRef);
              }}
              icon={
                <MaterialCommunityIcons
                  name="comment-edit-outline"
                  size={18}
                  color="white"
                />
              }
              rounded="full"
              className="flex-1"
              fontClassName="text-sm font-semibold"
            />
          )}
        </View>
      </View>

      {/* Review composer */}
      <ReviewComposerSheet
        businessId={businessId}
        sheetRef={reviewSheetRef}
        review={editingReview}
      />
    </View>
  );
}
