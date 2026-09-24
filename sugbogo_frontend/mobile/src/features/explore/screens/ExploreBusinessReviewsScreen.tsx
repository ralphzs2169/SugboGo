import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { router, useNavigation } from "expo-router";
import { Image } from "expo-image";
import LottieView from "lottie-react-native";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import loadingAnimation from "@/shared/assets/animations/loading.json";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { theme } from "@/constants/theme";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import BusinessProfileFooter from "../components/business-profile/BusinessProfileFooter";
import ReviewComposerSheet from "../components/business-profile/ReviewComposerSheet";
import BusinessReviewCard from "../components/business-profile/review-section/BusinessReviewCard";
import ReviewFiltersSection from "../components/business-profile/review-section/ReviewFiltersSection";
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

const MASCOT_EMPTY_REVIEWS = require("@/shared/assets/mascot/mascot-empty-reviews.webp");

type Props = {
  businessId: number;
  businessName?: string;
  isOwnBusiness: boolean;
};

/**
 * Displays paginated business reviews with server-owned filtering and sorting.
 * A bounded preview query supplies ownership independently of loaded pages.
 */
export default function ExploreBusinessReviewsScreen({
  businessId,
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
  const resultCount = reviewQuery.error
    ? totalCount
    : reviewQuery.totalCount;
  const hasContentFilters = Boolean(
    filters.sentiment ||
      filters.topic ||
      filters.hasPhotos ||
      filters.merchantReplied,
  );
  const canWriteReview = !isOwnBusiness && !ownership.userReview;
  const isInitialLoading =
    ownership.isLoading || reviewQuery.isInitialLoading;
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
    navigation.setOptions({ title: `Reviews (${resultCount})` });
  }, [navigation, resultCount]);

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
    <BusinessReviewCard
      businessId={businessId}
      review={item}
      isLast={index === displayedReviews.length - 1}
      onEdit={editReview}
    />
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
            void Promise.all([
              ownership.refetch(),
              reviewQuery.refetch(),
            ]);
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

            {/* Ownership shortcut and review creation */}
            {ownership.userReview && !isOwnBusiness && (
              <View className="flex-row items-center justify-between rounded-card border border-border-primary bg-surface px-4 py-3">
                <AppText className="flex-1 pr-3 text-sm text-text-secondary">
                  You reviewed this place
                </AppText>
                <Pressable
                  onPress={() => editReview(ownership.userReview!)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit your review"
                  className="cursor-pointer rounded-full px-2 py-2 active:opacity-70"
                >
                  <AppText weight="semibold" className="text-sm text-brand">
                    Edit review
                  </AppText>
                </Pressable>
              </View>
            )}

            {canWriteReview && totalCount > 0 && (
              <Button
                title="Write a review"
                onPress={createReview}
                rounded="full"
                className="mb-2 py-3"
                fontClassName="text-sm"
              />
            )}
          </View>
        }
        ListEmptyComponent={
          totalCount === 0 ? (
            <View className="mx-4 mt-10 items-center rounded-card bg-surface-secondary p-5">
              <Image
                source={MASCOT_EMPTY_REVIEWS}
                style={{ width: 120, height: 120 }}
                contentFit="contain"
                accessible={false}
              />
              <AppText weight="semibold" className="mt-2 text-center text-text-primary">
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
          ) : hasListError ? (
            <View className="mx-4 h-48">
              <ErrorState
                size="section"
                title="Unable to load reviews"
                description="Please try again with the selected filters."
                primaryActionTitle="Retry"
                onPrimaryAction={reviewQuery.refetch}
              />
            </View>
          ) : (
            <View className="mx-4 items-center rounded-card bg-surface-secondary px-5 py-6">
              <AppText weight="semibold" className="text-text-primary">
                {hasContentFilters
                  ? "No reviews match these filters"
                  : "No reviews to show right now"}
              </AppText>
              {hasContentFilters && (
                <>
                  <AppText className="mt-1 text-center text-sm text-text-secondary">
                    Try changing or clearing your filters.
                  </AppText>
                  <Button
                    title="Clear filters"
                    onPress={clearFilters}
                    variant="soft"
                    rounded="full"
                    size="sm"
                    className="mt-4"
                  />
                </>
              )}
            </View>
          )
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
          paddingBottom: isOwnBusiness ? 128 : insets.bottom + 32,
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

      {/* Owner action and review composer */}
      {isOwnBusiness && <BusinessProfileFooter isOwnBusiness />}
      <ReviewComposerSheet
        businessId={businessId}
        sheetRef={reviewSheetRef}
        review={editingReview}
      />
    </View>
  );
}
