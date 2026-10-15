import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useRef } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";

import MyReviewCard from "../components/reviews/MyReviewCard";
import MyReviewsSkeleton from "../components/reviews/MyReviewsSkeleton";
import { useMyReviews } from "../hooks/useMyReviews";

/** Coordinates private review history, refresh, pagination, and section recovery. */
export default function ReviewsSubmittedScreen() {
  const history = useMyReviews();
  const insets = useSafeAreaInsets();
  const paginationArmed = useRef(false);
  const paginationPending = useRef(false);

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
        renderItem={({ item }) => <MyReviewCard review={item} />}
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
    </View>
  );
}

/** Separates individual submissions without nested borders. */
function ReviewSeparator() {
  return <View className="h-3" />;
}
