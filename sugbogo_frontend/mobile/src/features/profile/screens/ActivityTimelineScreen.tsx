import { Image } from "expo-image";
import { router, Stack, useFocusEffect } from "expo-router";
import LottieView from "lottie-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import loadingAnimation from "@/shared/assets/animations/loading.json";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import EndOfListMessage from "@/shared/components/EndOfListMessage";
import ErrorState from "@/shared/components/ErrorState";
import SegmentedControl, {
  type SegmentedControlOption,
} from "@/shared/components/SegmentedControl";
import Skeleton from "@/shared/components/Skeleton";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import {
  defaultStackScreenOptions,
  slideFromRight,
} from "@/shared/navigation/stackOptions";

import ActivityTimelineItem from "../components/activity-timeline/ActivityTimelineItem";
import useActivityTimeline from "../hooks/useActivityTimeline";
import type {
  ActivityFilter,
  TimelineActivity,
} from "../types/activityTimeline.types";
import {
  activityDayKey,
  activityDayLabel,
} from "../utils/activityTimeline.utils";

const FILTERS: SegmentedControlOption<ActivityFilter>[] = [
  { value: "all", label: "All", accessibilityLabel: "Show all activity" },
  { value: "saves", label: "Saves", accessibilityLabel: "Show saves" },
  { value: "vouches", label: "Vouches", accessibilityLabel: "Show vouches" },
  { value: "reviews", label: "Reviews", accessibilityLabel: "Show reviews" },
];

const EMPTY_COPY = {
  all: {
    title: "Your story starts here",
    description:
      "Save places, vouch for specialties, and share reviews as you explore.",
  },
  saves: {
    title: "No saves yet",
    description: "Save a local business to a Pocket to find it here.",
  },
  vouches: {
    title: "No vouches yet",
    description: "Vouch for the specialties you enjoy at local businesses.",
  },
  reviews: {
    title: "No reviews yet",
    description:
      "Share your experience at a local business to start your review history.",
  },
};

export type ActivityTimelineState = {
  activities: TimelineActivity[];
  userId: number | null;
  isEnabled: boolean;
  isAuthLoading: boolean;
  isPending: boolean;
  hasData: boolean;
  error: unknown;
  isFetching: boolean;
  isRefetching: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  hasNextPage: boolean;
  refetch: () => Promise<unknown>;
  fetchNextPage: () => Promise<unknown>;
};

type ViewProps = {
  filter: ActivityFilter;
  onFilterChange: (filter: ActivityFilter) => void;
  history: ActivityTimelineState;
  onOpenActivity?: (activity: TimelineActivity) => void;
  onSignIn?: () => void;
};

/** Coordinates real account activity and focus refreshes for the production route. */
export default function ActivityTimelineScreen() {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const history = useActivityTimeline(filter);
  const { isEnabled, refetch } = history;

  useFocusEffect(
    useCallback(() => {
      if (isEnabled) {
        void refetch({ cancelRefetch: false });
      }
    }, [isEnabled, refetch]),
  );

  useQueryErrorNotification({
    error: isEnabled ? history.error : null,
    toastId: "activity-timeline-error",
    title: "Unable to load activity",
    fallbackMessage: "Please try again.",
  });

  return (
    <ActivityTimelineView
      filter={filter}
      onFilterChange={setFilter}
      history={{ ...history, hasData: Boolean(history.data) }}
    />
  );
}

/** Shares the production timeline layout with the isolated development gallery. */
export function ActivityTimelineView({
  filter,
  onFilterChange,
  history,
  onOpenActivity,
  onSignIn,
}: ViewProps) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<TimelineActivity>>(null);
  const paginationArmed = useRef(false);
  const paginationPending = useRef(false);
  const { isEnabled, refetch } = history;

  useEffect(() => {
    paginationArmed.current = false;
    paginationPending.current = false;
  }, [filter, history.userId]);

  function changeFilter(value: ActivityFilter) {
    onFilterChange(value);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  function loadNextPage(retry = false) {
    if (
      !isEnabled ||
      paginationPending.current ||
      (!retry && (!paginationArmed.current || history.isFetchNextPageError)) ||
      !history.hasNextPage ||
      history.isFetching
    ) {
      return;
    }
    paginationArmed.current = false;
    paginationPending.current = true;
    void history.fetchNextPage().finally(() => {
      paginationPending.current = false;
    });
  }

  function openActivity(activity: TimelineActivity) {
    if (onOpenActivity) {
      onOpenActivity(activity);
      return;
    }
    if (activity.type === "review") {
      router.push("/profile/reviews-submitted");
    } else if (activity.business.status === "active") {
      router.push({
        pathname: "/(explorer)/business/[businessId]",
        params: { businessId: String(activity.business.id) },
      });
    }
  }

  const initialLoading =
    history.isAuthLoading || (isEnabled && history.isPending);
  const initialError = isEnabled && Boolean(history.error) && !history.hasData;
  const refreshError =
    isEnabled &&
    Boolean(history.error) &&
    history.hasData &&
    !history.isFetchNextPageError;
  const copy = EMPTY_COPY[filter];

  return (
    <SafeAreaView edges={["left", "right"]} className="flex-1 bg-surface">
      {/* Profile stack navigation */}
      <Stack.Screen
        options={{
          ...defaultStackScreenOptions,
          ...slideFromRight,
          title: "Activity Timeline",
        }}
      />

      {/* Server-filtered activity categories */}
      <View className="border-b border-border-primary/60 bg-surface px-4 pb-4 pt-3">
        <SegmentedControl
          options={FILTERS}
          value={filter}
          onChange={changeFilter}
          variant="sm"
        />
      </View>

      {/* Chronological activity and date groups */}
      <FlatList
        key={`${history.userId ?? "signed-out"}:${filter}`}
        ref={listRef}
        testID="activity-timeline-list"
        data={history.activities}
        keyExtractor={(activity) => activity.id}
        renderItem={({ item, index }) => {
          const day = activityDayKey(item.occurred_at);
          const previous = history.activities[index - 1];
          const next = history.activities[index + 1];
          const showDate =
            !previous || activityDayKey(previous.occurred_at) !== day;
          const continues = Boolean(
            next && activityDayKey(next.occurred_at) === day,
          );
          return (
            <View className={continues ? "bg-surface" : "bg-surface pb-2"}>
              {showDate && (
                <>
                  {/* Match profile sections: a neutral gutter and a ruled title. */}
                  <View className={previous ? "h-2 bg-background" : "hidden"} />
                  <View className="mx-4 mb-3 border-b border-border-primary pt-4">
                    <AppText
                      accessibilityRole="header"
                      weight="semibold"
                      className="mb-2 text-xs text-text-secondary"
                    >
                      {activityDayLabel(item.occurred_at)}
                    </AppText>
                  </View>
                </>
              )}
              <ActivityTimelineItem
                activity={item}
                isFirst={showDate}
                continues={continues}
                onPress={() => openActivity(item)}
              />
            </View>
          );
        }}
        ListHeaderComponent={
          refreshError ? (
            <ErrorState
              size="section"
              title="Unable to refresh activity"
              description="Your loaded activity is still available."
              primaryActionTitle="Retry"
              onPrimaryAction={() => void refetch()}
            />
          ) : null
        }
        ListEmptyComponent={
          initialLoading ? (
            <View
              accessibilityLabel="Loading activity"
              className="gap-6 px-4 py-4"
            >
              {[0, 1, 2].map((row) => (
                <View key={row} className="flex-row gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <View className="flex-1 gap-2">
                    <Skeleton className="h-4 w-4/5 rounded-md" />
                    <Skeleton className="h-4 w-3/5 rounded-md" />
                  </View>
                </View>
              ))}
            </View>
          ) : !isEnabled ? (
            <View className="items-center gap-3 px-6 py-10">
              <AppText weight="semibold" className="text-md text-text-primary">
                Sign in to view your activity
              </AppText>
              <Button
                title="Sign in"
                onPress={onSignIn ?? (() => router.push("/(auth)/login"))}
              />
            </View>
          ) : initialError ? (
            <ErrorState
              title="Unable to load activity"
              description="Please try again to load your timeline."
              primaryActionTitle="Retry"
              onPrimaryAction={() => void refetch()}
            />
          ) : (
            <View className="items-center px-8 py-10">
              <Image
                source={require("@/shared/assets/mascot/mascot-no-filter-result.webp")}
                style={{ width: 120, height: 120 }}
                contentFit="contain"
              />
              <AppText
                weight="bold"
                className="mt-2 text-center text-md text-text-primary"
              >
                {copy.title}
              </AppText>
              <AppText className="mt-1 text-center text-sm leading-5 text-text-secondary">
                {copy.description}
              </AppText>
            </View>
          )
        }
        ListFooterComponent={
          history.isFetchingNextPage ? (
            <View className="items-center py-5" testID="activity-page-loader">
              <LottieView
                source={loadingAnimation}
                autoPlay
                loop
                style={{ width: 50, height: 50 }}
              />
            </View>
          ) : isEnabled && history.isFetchNextPageError ? (
            <ErrorState
              size="section"
              title="Unable to load more activity"
              description="Your loaded activity is still available."
              primaryActionTitle="Retry next page"
              onPrimaryAction={() => loadNextPage(true)}
            />
          ) : history.activities.length >= 5 &&
            !history.hasNextPage &&
            !history.isFetching &&
            !history.error ? (
            <EndOfListMessage description="You've reached the end of your activity." />
          ) : null
        }
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: Math.max(insets.bottom, 24),
        }}
        onScrollBeginDrag={() => {
          paginationArmed.current = true;
        }}
        onMomentumScrollBegin={() => {
          paginationArmed.current = true;
        }}
        onEndReached={() => loadNextPage()}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            refreshing={history.isRefetching && !history.isFetchingNextPage}
            onRefresh={() => {
              if (isEnabled && !history.isFetching) {
                void refetch();
              }
            }}
            tintColor={theme.extends.colors.brand}
          />
        }
      />
    </SafeAreaView>
  );
}
