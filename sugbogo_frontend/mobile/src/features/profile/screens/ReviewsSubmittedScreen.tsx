import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import LottieView from "lottie-react-native";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useEffect, useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import ReviewComposerSheet from "@/features/explore/components/business-profile/ReviewComposerSheet";
import { ReviewDerivedDataSyncProvider } from "@/features/explore/hooks/ReviewDerivedDataSyncProvider";
import ActionBottomSheet from "@/shared/components/bottom-sheets/ActionBottomSheet";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";

import MyReviewCard from "../components/reviews/MyReviewCard";
import MyReviewDeleteConfirmation from "../components/reviews/MyReviewDeleteConfirmation";
import MyReviewsSkeleton from "../components/reviews/MyReviewsSkeleton";
import { useMyReviews } from "../hooks/useMyReviews";
import type { MyReview } from "../types/myReview.types";

type SelectedReview = { userId: number; review: MyReview };

/** Coordinates private review history, refresh, pagination, and section recovery. */
export default function ReviewsSubmittedScreen() {
  const history = useMyReviews();
  const insets = useSafeAreaInsets();
  const paginationArmed = useRef(false);
  const paginationPending = useRef(false);
  const actionsRef = useRef<BottomSheetModal | null>(null);
  const composerRef = useRef<BottomSheetModal | null>(null);
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
  const isConfirmingDeletion =
    history.isEnabled && deletingReview?.userId === history.userId;

  const canManage = (review: MyReview) =>
    history.isEnabled &&
    review.author.id === history.userId &&
    review.is_own_review;

  const canEdit = (review: MyReview) =>
    canManage(review) && review.status !== "under_review";

  const openActions = (review: MyReview) => {
    if (!canManage(review) || history.userId === null || isConfirmingDeletion)
      return;
    setActionReview({ userId: history.userId, review });
    presentBottomSheet(actionsRef);
  };

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
    if (
      !actionReview ||
      isConfirmingDeletion ||
      actionReview.userId !== history.userId ||
      !canEdit(actionReview.review)
    )
      return;

    // Keep a stable edit snapshot so history refetches cannot replace a draft.
    setEditingReview(actionReview);
    registerSyncBusiness(actionReview);
    presentBottomSheet(composerRef);
  };

  const openDeleteConfirmation = () => {
    if (
      !actionReview ||
      isConfirmingDeletion ||
      actionReview.userId !== history.userId ||
      !canManage(actionReview.review)
    )
      return;

    registerSyncBusiness(actionReview);
    setDeletingReview(actionReview);
  };

  const currentEditor =
    history.isEnabled && editingReview?.userId === history.userId
      ? editingReview.review
      : null;
  const currentDeletion =
    history.isEnabled && deletingReview?.userId === history.userId
      ? deletingReview
      : null;

  useEffect(() => {
    paginationArmed.current = false;
    paginationPending.current = false;
  }, [history.userId]);

  useQueryErrorNotification({
    error: history.error,
    toastId: "my-reviews",
    title: "Unable to load your reviews",
    fallbackMessage: "Please try again.",
  });

  const loadNextPage = (retry = false) => {
    if (
      !history.isEnabled ||
      paginationPending.current ||
      (!retry && (!paginationArmed.current || history.isFetchNextPageError)) ||
      !history.hasNextPage ||
      history.isFetchingNextPage ||
      history.isFetching
    )
      return;

    paginationPending.current = true;
    paginationArmed.current = false;
    void history.fetchNextPage().finally(() => {
      paginationPending.current = false;
    });
  };

  const initialLoading =
    history.isAuthLoading || (history.isEnabled && history.isPending);
  const hasReviews = history.reviews.length > 0;

  return (
    <View className="flex-1 bg-background">
      {/* Profile stack header */}
      <Stack.Screen
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          title: "My Reviews",
        }}
      />

      {/* Author history and refresh */}
      <FlatList
        key={history.userId ?? "signed-out"}
        testID="my-reviews-list"
        data={history.reviews}
        keyExtractor={(review) => String(review.id)}
        renderItem={({ item }) => (
          <MyReviewCard
            review={item}
            onActions={canManage(item) ? () => openActions(item) : undefined}
          />
        )}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 24,
          flexGrow: 1,
        }}
        ItemSeparatorComponent={ReviewSeparator}
        ListHeaderComponent={
          hasReviews ? (
            <View className="pb-4">
              <AppText weight="semibold" className="text-sm text-text-primary">
                {history.totalCount} submitted{" "}
                {history.totalCount === 1 ? "review" : "reviews"}
              </AppText>
              <AppText className="mt-1 text-xs text-text-secondary">
                Newest first · Includes unpublished reviews
              </AppText>
            </View>
          ) : null
        }
        ListEmptyComponent={
          initialLoading ? (
            <MyReviewsSkeleton />
          ) : !history.isEnabled ? (
            <View className="py-10">
              <AppText className="text-center text-text-secondary">
                Sign in to view your reviews.
              </AppText>
            </View>
          ) : history.error ? (
            <ErrorState
              title="Unable to load your reviews"
              description="Please try again to see your review history."
              primaryActionTitle="Retry"
              onPrimaryAction={() => void history.refetch()}
            />
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
            <View className="py-4">
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
          ) : hasReviews && !history.hasNextPage && !history.isFetching ? (
            <EndOfListMessage description="You're all caught up." />
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
            enabled={history.isEnabled}
            onRefresh={() => {
              if (history.isEnabled && !history.isFetching)
                void history.refetch();
            }}
            tintColor={theme.extends.colors.brand}
          />
        }
      />

      {/* Contextual actions respect editing restrictions across all statuses. */}
      <ActionBottomSheet
        key={`review-actions-${history.userId ?? "signed-out"}`}
        sheetRef={actionsRef}
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

      {/* Keep business synchronization mounted after edit/delete dialogs close. */}
      {syncBusinesses
        .filter((item) => history.isEnabled && item.userId === history.userId)
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
              />
            )}

            {/* Confirmed deletion uses the same business synchronization owner. */}
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

/** Separates individual submissions without nested borders. */
function ReviewSeparator() {
  return <View className="h-3" />;
}
