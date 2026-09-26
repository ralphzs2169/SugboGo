import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router, useNavigation } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import loadingAnimation from "@/shared/assets/animations/loading.json";
import Button from "@/shared/components/Button";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { theme } from "@/constants/theme";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import BusinessProfileFooter from "../components/business-profile/BusinessProfileFooter";
import ReviewComposerSheet from "../components/business-profile/ReviewComposerSheet";
import BusinessReviewCard from "../components/business-profile/reviews/BusinessReviewCard";
import ReviewFiltersSection from "../components/business-profile/reviews/review-collection/ReviewFiltersSection";
import BusinessReviewsSkeleton from "../components/business-profile/state/BusinessReviewsSkeleton";
import {
  useBusinessReviewPreview,
  useBusinessReviews,
} from "../hooks/useBusinessReviews";
import useExploreBusinessProfile from "../hooks/useExploreBusinessProfile";
import {
  DEFAULT_BUSINESS_REVIEW_FILTERS,
  type BusinessReview,
  type BusinessReviewFilters,
} from "../types/review.types";
import ReviewCollectionEmptyState from "../components/business-profile/state/ReviewCollectionEmptyState";
import { shadows } from "@/shared/styles/shadows";

type Props = {
  businessId: number;
  businessName?: string;
  isOwnBusiness: boolean;
};

/**
 * Displays paginated business reviews with server-owned filtering and sorting.
 * A bounded preview query supplies ownership independently of loaded pages.
 */
export default function ReviewsCollectionScreen({
  businessId,
  businessName,
  isOwnBusiness = false,
}: Props) {
  const [filters, setFilters] = useState<BusinessReviewFilters>(
    DEFAULT_BUSINESS_REVIEW_FILTERS,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingReview, setEditingReview] = useState<BusinessReview | null>(
    null,
  );

  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const reviewSheetRef = useRef<BottomSheetModal | null>(null);
  const isEndReachedRef = useRef(false);

  const ownership = useBusinessReviewPreview(businessId);
  const reviewQuery = useBusinessReviews(businessId, filters);
  const {
    business,
    isLoading: insightsLoading,
    error: insightsError,
    refetch: refetchInsights,
  } = useExploreBusinessProfile(businessId);

  const totalCount = ownership.totalCount ?? 0;
  const hasContentFilters = Boolean(
    filters.sentiment ||
    filters.topic ||
    filters.hasPhotos ||
    filters.merchantReplied,
  );
  const canWriteReview = !isOwnBusiness && !ownership.userReview;
  const showWriteReviewFab = canWriteReview && totalCount > 0;
  const isInitialLoading = ownership.isLoading || reviewQuery.isInitialLoading;
  const isInitialError = Boolean(
    ownership.error ||
    (reviewQuery.error &&
      !reviewQuery.isFetchNextPageError &&
      !hasContentFilters &&
      filters.ordering === "newest" &&
      reviewQuery.reviews.length === 0),
  );
  const isUpdatingResults =
    reviewQuery.isFetching &&
    !reviewQuery.isInitialLoading &&
    !reviewQuery.isFetchingNextPage &&
    !isRefreshing;
  const hasListError = Boolean(
    reviewQuery.error && !reviewQuery.isFetchNextPageError,
  );
  const displayedReviews = hasListError ? [] : reviewQuery.reviews;
  const shouldShowEndMessage =
    !reviewQuery.isInitialLoading &&
    !reviewQuery.error &&
    !reviewQuery.hasNextPage &&
    !reviewQuery.isFetchingNextPage &&
    reviewQuery.reviews.length >= 5;

  useEffect(() => {
    navigation.setOptions({ title: `Reviews (${totalCount})` });
  }, [navigation, totalCount]);

  useQueryErrorNotification({
    error: reviewQuery.error,
    toastId: `business-reviews-${businessId}`,
    title: "Unable to load reviews",
    fallbackMessage: "Please try again.",
  });

  useQueryErrorNotification({
    error: ownership.error,
    toastId: `business-review-ownership-${businessId}`,
    title: "Unable to load your review",
    fallbackMessage: "Please try again.",
  });

  const editReview = (review: BusinessReview) => {
    setEditingReview(review);
    presentBottomSheet(reviewSheetRef);
  };

  const createReview = () => {
    setEditingReview(null);
    presentBottomSheet(reviewSheetRef);
  };

  const clearFilters = () => {
    setFilters({
      ...DEFAULT_BUSINESS_REVIEW_FILTERS,
      ordering: filters.ordering,
    });
  };

  const refreshScreen = async () => {
    setIsRefreshing(true);

    try {
      await Promise.all([
        reviewQuery.refetch(),
        ownership.refetch(),
        refetchInsights(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadNextPage = () => {
    if (
      isEndReachedRef.current ||
      !reviewQuery.hasNextPage ||
      reviewQuery.isFetchingNextPage ||
      reviewQuery.isFetching ||
      reviewQuery.isPlaceholderData
    ) {
      return;
    }

    isEndReachedRef.current = true;

    void reviewQuery.fetchNextPage().finally(() => {
      isEndReachedRef.current = false;
    });
  };

  const renderReview = ({
    item,
    index,
  }: ListRenderItemInfo<BusinessReview>) => (
    <View className="px-4">
      <BusinessReviewCard
        businessId={businessId}
        review={item}
        isLast={index === displayedReviews.length - 1}
        onEdit={editReview}
      />
    </View>
  );

  if (isInitialLoading) {
    return <BusinessReviewsSkeleton bottomInset={insets.bottom} />;
  }

  if (isInitialError) {
    return (
      <View className="flex-1 bg-surface">
        <ErrorState
          size="small"
          icon="comment-off-outline"
          title="Unable to load reviews"
          description="We couldn't load the reviews right now. Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={() => {
            void Promise.all([ownership.refetch(), reviewQuery.refetch()]);
          }}
          secondaryActionTitle="Go Back"
          onSecondaryAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {/* Paginated reviews and controls */}
      <FlatList
        testID="reviews-list"
        data={displayedReviews}
        keyExtractor={(review) => String(review.id)}
        renderItem={renderReview}
        ListHeaderComponent={
          <View className="gap-3 px-4 pt-5">
            {/* Insights and review controls */}
            {totalCount > 0 && (
              <ReviewFiltersSection
                insights={business?.review_insights}
                insightsLoading={insightsLoading}
                insightsError={Boolean(insightsError)}
                onRetryInsights={() => void refetchInsights()}
                filters={filters}
                onChange={setFilters}
                onClear={clearFilters}
              />
            )}
          </View>
        }
        ListEmptyComponent={
          <ReviewCollectionEmptyState
            totalCount={totalCount}
            hasListError={hasListError}
            hasContentFilters={hasContentFilters}
            canWriteReview={canWriteReview}
            isOwnBusiness={isOwnBusiness}
            onCreateReview={createReview}
            onClearFilters={clearFilters}
            onRetry={() => void reviewQuery.refetch()}
          />
        }
        ListFooterComponent={
          reviewQuery.isFetchingNextPage && !isRefreshing ? (
            <View className="items-center py-5" testID="reviews-page-loader">
              <LottieView
                source={loadingAnimation}
                autoPlay
                loop
                style={{ width: 50, height: 50 }}
              />
            </View>
          ) : reviewQuery.isFetchNextPageError ? (
            <View className="items-center py-5">
              <Button
                title="Retry loading reviews"
                onPress={loadNextPage}
                variant="soft"
                rounded="full"
                size="sm"
              />
            </View>
          ) : shouldShowEndMessage ? (
            <EndOfListMessage />
          ) : null
        }
        contentContainerStyle={{
          paddingBottom: isOwnBusiness
            ? 128
            : insets.bottom + (showWriteReviewFab ? 112 : 32),
        }}
        onEndReached={loadNextPage}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshScreen}
            tintColor={theme.extends.colors.brand}
          />
        }
      />

      {/* Lightweight filter update feedback */}
      {isUpdatingResults && (
        <View
          pointerEvents="none"
          className="absolute left-0 right-0 top-1/2 z-20 items-center"
        >
          <View className="rounded-full bg-surface/90 p-2">
            <LottieView
              source={loadingAnimation}
              autoPlay
              loop
              style={{ width: 36, height: 36 }}
            />
          </View>
        </View>
      )}

      {/* Review creation action */}
      {showWriteReviewFab && (
        <View
          className="absolute right-4 z-30 rounded-full bg-brand"
          style={[{ bottom: insets.bottom + 16 }, shadows.floating]}
        >
          <Button
            title="Write review"
            accessibilityLabel="Write a review"
            onPress={createReview}
            icon={
              <MaterialCommunityIcons name="pencil" size={18} color="#FFFFFF" />
            }
            rounded="full"
            className="px-5 py-3.5"
            fontClassName="text-sm"
          />
        </View>
      )}
      {/* Owner action and review composer */}
      {isOwnBusiness && <BusinessProfileFooter isOwnBusiness />}
      <ReviewComposerSheet
        businessId={businessId}
        businessName={business?.business_name ?? businessName ?? "Business"}
        coverPhotoUrl={business?.cover_photo_url}
        sheetRef={reviewSheetRef}
        review={editingReview}
      />
    </View>
  );
}
