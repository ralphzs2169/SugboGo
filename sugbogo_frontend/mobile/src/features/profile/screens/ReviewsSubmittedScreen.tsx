import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import LottieView from "lottie-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import ReviewComposerSheet from "@/features/explore/components/business-profile/ReviewComposerSheet";
import { ReviewDerivedDataSyncProvider } from "@/features/explore/hooks/ReviewDerivedDataSyncProvider";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import ActionBottomSheet from "@/shared/components/bottom-sheets/ActionBottomSheet";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import FilterChip from "@/shared/components/FilterChip";
import SafePressable from "@/shared/components/SafePressable";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import MyReviewCard from "../components/reviews/MyReviewCard";
import MyReviewDeleteConfirmation from "../components/reviews/MyReviewDeleteConfirmation";
import MyReviewsSkeleton from "../components/reviews/MyReviewsSkeleton";
import { useMyReviews } from "../hooks/useMyReviews";
import type { MyReview, MyReviewOrdering } from "../types/myReview.types";

type ReviewFilter = "all" | "published" | "under_review" | "not_published";

const REVIEW_FILTERS: {
  value: ReviewFilter;
  label: string;
  accessibilityLabel: string;
}[] = [
  { value: "all", label: "All", accessibilityLabel: "Show all reviews" },
  {
    value: "published",
    label: "Published",
    accessibilityLabel: "Show published reviews",
  },
  {
    value: "under_review",
    label: "Under review",
    accessibilityLabel: "Show reviews under review",
  },
  {
    value: "not_published",
    label: "Not published",
    accessibilityLabel: "Show reviews that are not published",
  },
];

type SelectedReview = { userId: number; review: MyReview };

const SIGN_IN_ROUTE = "/(auth)/login";

/**
 * Displays authenticated review history in a full-width, separated list.
 *
 * Coordinates pagination, editing, deletion, and business-specific review
 * synchronization while preserving the existing SugboGo interaction patterns.
 */
export default function ReviewsSubmittedScreen() {
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [ordering, setOrdering] = useState<MyReviewOrdering>("newest");
  const history = useMyReviews(reviewFilter, ordering);
  const insets = useSafeAreaInsets();

  const paginationArmed = useRef(false);
  const paginationPending = useRef(false);
  const actionsRef = useRef<BottomSheetModal | null>(null);
  const composerRef = useRef<BottomSheetModal | null>(null);
  const sortRef = useRef<BottomSheetModal | null>(null);

  const [actionReview, setActionReview] = useState<SelectedReview | null>(null);
  const [deletingReview, setDeletingReview] = useState<SelectedReview | null>(
    null,
  );
  const [editingReview, setEditingReview] = useState<SelectedReview | null>(
    null,
  );
  const [syncBusinesses, setSyncBusinesses] = useState<
    { userId: number; businessId: number }[]
  >([]);

  const isEnabled = history.isEnabled;
  const userId = history.userId;
  const isConfirmingDeletion = isEnabled && deletingReview?.userId === userId;

  const canManage = useCallback(
    (review: MyReview) =>
      isEnabled && review.author.id === userId && review.is_own_review,
    [isEnabled, userId],
  );

  const canEdit = (review: MyReview) =>
    canManage(review) && review.status !== "under_review";

  /** Returns the selected review only if it is still safe to act on. */
  const getActionableReview = (predicate: (review: MyReview) => boolean) => {
    if (
      !actionReview ||
      isConfirmingDeletion ||
      actionReview.userId !== userId ||
      !predicate(actionReview.review)
    ) {
      return null;
    }

    return actionReview;
  };

  const openActions = useCallback(
    (review: MyReview) => {
      if (!canManage(review) || userId === null || isConfirmingDeletion) return;

      setActionReview({ userId, review });
      presentBottomSheet(actionsRef);
    },
    [canManage, userId, isConfirmingDeletion],
  );

  const renderReview = useCallback(
    ({ item, index }: { item: MyReview; index: number }) => (
      <View
        className={index === 0 ? "border-t border-border-primary" : undefined}
      >
        <MyReviewCard
          review={item}
          onActions={canManage(item) ? openActions : undefined}
        />
      </View>
    ),
    [canManage, openActions],
  );

  const registerSyncBusiness = (selected: SelectedReview) => {
    setSyncBusinesses((current) => {
      const businesses = current.filter(
        (item) => item.userId === selected.userId,
      );

      if (
        businesses.some(
          (item) => item.businessId === selected.review.business.id,
        )
      ) {
        return businesses;
      }

      return [
        ...businesses,
        {
          userId: selected.userId,
          businessId: selected.review.business.id,
        },
      ];
    });
  };

  const openEditor = () => {
    const selected = getActionableReview(canEdit);
    if (!selected) return;

    setEditingReview(selected);
    registerSyncBusiness(selected);
    presentBottomSheet(composerRef);
  };

  const openDeleteConfirmation = () => {
    const selected = getActionableReview(canManage);
    if (!selected) return;

    registerSyncBusiness(selected);
    setDeletingReview(selected);
  };

  const currentEditor =
    isEnabled && editingReview?.userId === userId ? editingReview.review : null;

  const currentDeletion =
    isEnabled && deletingReview?.userId === userId ? deletingReview : null;

  useEffect(() => {
    paginationArmed.current = false;
    paginationPending.current = false;
  }, [userId, reviewFilter, ordering]);

  useQueryErrorNotification({
    error: history.error,
    toastId: "my-reviews",
    title: "Unable to load your reviews",
    fallbackMessage: "Please try again.",
  });

  const loadNextPage = (retry = false) => {
    if (
      !isEnabled ||
      paginationPending.current ||
      (!retry && (!paginationArmed.current || history.isFetchNextPageError)) ||
      !history.hasNextPage ||
      history.isFetchingNextPage ||
      history.isFetching
    ) {
      return;
    }

    paginationPending.current = true;
    paginationArmed.current = false;

    void history.fetchNextPage().finally(() => {
      paginationPending.current = false;
    });
  };

  const initialLoading =
    history.isAuthLoading || (isEnabled && history.isPending);
  const hasReviews = history.reviews.length > 0;
  const showEndMessage =
    hasReviews && !history.error && !history.hasNextPage && !history.isFetching;
  const reviewCounts = history.summary;
  const filteredEmptyLabel =
    reviewFilter === "under_review"
      ? "reviews under review"
      : reviewFilter === "not_published"
        ? "unpublished reviews"
        : "published reviews";

  return (
    <View className="flex-1 bg-surface">
      {/* Profile stack header */}
      <Stack.Screen
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          title: "My Reviews",
        }}
      />

      {/* Full-width review history */}
      <FlatList
        key={`${userId ?? "signed-out"}:${reviewFilter}:${ordering}`}
        testID="my-reviews-list"
        data={history.reviews}
        keyExtractor={(review) => String(review.id)}
        renderItem={renderReview}
        className="flex-1 bg-surface"
        contentContainerStyle={{
          flexGrow: 1,
        }}
        ListFooterComponentStyle={{
          flexGrow: showEndMessage ? 1 : 0,
          backgroundColor: showEndMessage
            ? theme.extends.colors.background
            : theme.extends.colors.surface,
          paddingBottom: insets.bottom,
        }}
        ItemSeparatorComponent={ReviewSeparator}
        ListHeaderComponent={
          isEnabled ? (
            <View className="gap-2 px-4 pb-3 pt-4">
              <View className="mb-1 flex-row items-center justify-between gap-3">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  Your reviews
                </AppText>
                <AppText className="text-sm text-text-secondary">
                  {reviewCounts?.total.toLocaleString() ?? "—"} total
                </AppText>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 6 }}
              >
                {REVIEW_FILTERS.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={`${option.label}${reviewCounts ? ` ${reviewCounts[option.value === "all" ? "total" : option.value].toLocaleString()}` : ""}`}
                    selected={reviewFilter === option.value}
                    accessibilityLabel={`${option.accessibilityLabel}${reviewCounts ? `, ${reviewCounts[option.value === "all" ? "total" : option.value].toLocaleString()} reviews` : ""}`}
                    onPress={() => setReviewFilter(option.value)}
                  />
                ))}
              </ScrollView>
              <View className="flex-row items-center justify-end gap-2">
                <SafePressable
                  accessibilityRole="button"
                  accessibilityLabel={`Sort reviews: ${ordering === "oldest" ? "Oldest first" : "Newest first"}`}
                  onPress={() => presentBottomSheet(sortRef)}
                  className="min-h-11 flex-row items-center gap-1 active:opacity-75"
                >
                  <AppText className="text-sm text-text-secondary">
                    {ordering === "oldest" ? "Oldest first" : "Newest first"}
                  </AppText>
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={18}
                    color={theme.extends.colors.text.secondary}
                  />
                </SafePressable>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          initialLoading ? (
            <MyReviewsSkeleton />
          ) : !isEnabled ? (
            <View
              testID="my-reviews-signed-out"
              className="items-center px-4 py-10"
            >
              <View className="h-20 w-20 items-center justify-center rounded-full bg-surface-muted">
                <MaterialCommunityIcons
                  name="account-circle-outline"
                  size={40}
                  color={theme.extends.colors.text.secondary}
                />
              </View>
              <AppText
                weight="bold"
                className="mt-4 text-center text-lg text-text-primary"
              >
                Sign in to see your reviews
              </AppText>
              <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
                Your review history and any replies from businesses will show up
                here.
              </AppText>
              <Button
                title="Sign in"
                onPress={() => router.push(SIGN_IN_ROUTE)}
                variant="primary"
                rounded="full"
                size="sm"
                className="mt-5"
              />
            </View>
          ) : history.error ? (
            <ErrorState
              title="Unable to load your reviews"
              description="Please try again to see your review history."
              primaryActionTitle="Retry"
              onPrimaryAction={() => void history.refetch()}
            />
          ) : reviewFilter !== "all" ? (
            <View className="items-center px-4 py-10">
              <AppText
                weight="semibold"
                className="text-center text-base text-text-primary"
              >
                No {filteredEmptyLabel} found
              </AppText>
              <AppText className="mt-1 text-center text-sm text-text-secondary">
                Try another status filter.
              </AppText>
            </View>
          ) : (
            <View testID="my-reviews-empty" className="items-center px-4 py-10">
              <Image
                source={require("@/shared/assets/mascot/mascot-empty-reviews.webp")}
                style={{ width: 120, height: 120 }}
                contentFit="contain"
                accessible={false}
              />
              <AppText
                weight="bold"
                className="mt-2 text-center text-lg text-text-primary"
              >
                No reviews yet
              </AppText>
              <AppText className="mt-2 text-center text-sm leading-5 text-text-secondary">
                Your submitted reviews will appear here. Explore local
                businesses and share your experience.
              </AppText>
              <Button
                title="Explore businesses"
                onPress={() => router.push("/(explorer)/(tabs)/explore")}
                variant="soft"
                rounded="full"
                size="sm"
                className="mt-5"
              />
            </View>
          )
        }
        ListFooterComponent={
          history.isFetchingNextPage ? (
            <View className="items-center py-5" testID="my-reviews-page-loader">
              <LottieView
                source={loadingAnimation}
                autoPlay
                loop
                style={{ width: 50, height: 50 }}
              />
            </View>
          ) : hasReviews && history.error ? (
            <View className="px-4 py-4">
              <ErrorState
                size="section"
                title={
                  history.isFetchNextPageError
                    ? "Couldn't load more reviews"
                    : "Couldn't refresh your reviews"
                }
                description="Your loaded reviews are still available."
                primaryActionTitle="Retry"
                onPrimaryAction={() =>
                  history.isFetchNextPageError
                    ? loadNextPage(true)
                    : void history.refetch()
                }
              />
            </View>
          ) : showEndMessage ? (
            <EndOfListMessage description="You've seen all your submitted reviews." />
          ) : null
        }
        onScrollBeginDrag={() => {
          paginationArmed.current = true;
        }}
        onEndReached={() => loadNextPage()}
        onEndReachedThreshold={0.35}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={history.isRefetching && !history.isFetchingNextPage}
            enabled={isEnabled}
            onRefresh={() => {
              if (isEnabled && !history.isFetching) void history.refetch();
            }}
            tintColor={theme.extends.colors.brand}
          />
        }
      />

      {/* Contextual edit and delete actions */}
      <ActionBottomSheet
        sheetRef={sortRef}
        options={[
          { label: "Newest first", value: "newest" },
          { label: "Oldest first", value: "oldest" },
        ]}
        onSelect={(value) => setOrdering(value as MyReviewOrdering)}
      />
      <ActionBottomSheet
        key={`review-actions-${userId ?? "signed-out"}`}
        sheetRef={actionsRef}
        onDismiss={() =>
          setActionReview((current) =>
            current === actionReview ? null : current,
          )
        }
        options={[
          ...(actionReview && canEdit(actionReview.review)
            ? [{ label: "Edit my review", value: "edit" }]
            : []),
          {
            label: "Delete review",
            value: "delete",
            color: theme.extends.colors.error,
          },
        ]}
        onSelect={(value) => {
          if (value === "edit") openEditor();
          if (value === "delete") openDeleteConfirmation();
        }}
      />

      {/* Business-specific edit and deletion synchronization */}
      {syncBusinesses
        .filter((item) => isEnabled && item.userId === userId)
        .map((item) => (
          <ReviewDerivedDataSyncProvider
            key={`review-sync-${item.userId}-${item.businessId}`}
            businessId={item.businessId}
          >
            {currentEditor?.business.id === item.businessId && (
              <ReviewComposerSheet
                businessId={currentEditor.business.id}
                businessName={currentEditor.business.business_name}
                coverPhotoUrl={currentEditor.business.display_cover_photo_url}
                sheetRef={composerRef}
                review={currentEditor}
                onDismiss={() =>
                  setEditingReview((current) =>
                    current === editingReview ? null : current,
                  )
                }
              />
            )}

            {/* Confirmed review deletion */}
            {currentDeletion?.review.business.id === item.businessId && (
              <MyReviewDeleteConfirmation
                key={`${currentDeletion.userId}-${currentDeletion.review.id}`}
                review={currentDeletion.review}
                userId={currentDeletion.userId}
                onClose={() =>
                  setDeletingReview((current) =>
                    current === currentDeletion ? null : current,
                  )
                }
              />
            )}
          </ReviewDerivedDataSyncProvider>
        ))}
    </View>
  );
}

/** Separates review rows with a subtle inset divider. */
function ReviewSeparator() {
  return <View className="mx-4 h-px bg-border-primary" />;
}
