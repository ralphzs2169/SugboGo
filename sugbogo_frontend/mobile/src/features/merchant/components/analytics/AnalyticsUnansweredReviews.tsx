import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef } from "react";
import { useWindowDimensions, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";

import type { MerchantUnansweredReviewsSummary } from "../../types/merchantAnalytics.types";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";

import AnalyticsOverviewSection from "./AnalyticsOverviewSection";
import AnalyticsUnansweredReviewsSheet from "./AnalyticsUnansweredReviewsSheet";

type Props = {
  data?: MerchantUnansweredReviewsSummary;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onReview: () => void;
};

const AGE_COLORS = {
  recent: "#CBD0D8",
  waiting: "#E8B66D",
  overdue: theme.extends.colors.brand,
};

/**
 * Summarizes the current unanswered-review backlog through a
 * prominent metric card, proportional age distribution, and
 * direct navigation to the oldest reviews.
 *
 * Provides an information sheet for measurement definitions
 * while preserving independent loading, error recovery,
 * responsive layout, and completed states.
 */
export default function AnalyticsUnansweredReviews({
  data,
  loading,
  error,
  onRetry,
  onReview,
}: Props) {
  const sheetRef = useRef<BottomSheetModal>(null);

  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 375 || fontScale >= 1.35;

  const groups = data
    ? [
        {
          key: "under-3",
          label: "Under 3 days",
          count: data.under_3_days,
          color: AGE_COLORS.recent,
        },
        {
          key: "3-to-6",
          label: "3–6 days",
          count: data.days_3_to_6,
          color: AGE_COLORS.waiting,
        },
        {
          key: "7-plus",
          label: "7+ days",
          count: data.days_7_plus,
          color: AGE_COLORS.overdue,
        },
      ]
    : [];

  const hasAgeCounts = groups.some((group) => group.count > 0);

  return (
    <>
      <AnalyticsOverviewSection
        title="Reviews needing replies"
        description="Your current unanswered review backlog"
        accessory={
          <SafePressable
            accessibilityRole="button"
            accessibilityLabel="About reviews needing replies"
            accessibilityHint="Opens review backlog measurement details"
            onPress={() => sheetRef.current?.present()}
            className="h-11 w-11 cursor-pointer items-center justify-center rounded-full active:bg-surface-muted"
          >
            <MaterialCommunityIcons
              name="information-outline"
              size={22}
              color={theme.extends.colors.text.secondary}
              accessible={false}
            />
          </SafePressable>
        }
      >
        {/* Initial loading state */}
        {loading && !data && !error && (
          <View
            accessibilityLabel="Loading reviews needing replies"
            accessibilityState={{ busy: true }}
            className="gap-4 py-2"
          >
            <View className="gap-2">
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-4 w-40 rounded-md" />
            </View>

            <Skeleton className="h-2.5 w-full rounded-full" />

            <View className="flex-row gap-3">
              <Skeleton className="h-14 flex-1 rounded-lg" />
              <Skeleton className="h-14 flex-1 rounded-lg" />
              <Skeleton className="h-14 flex-1 rounded-lg" />
            </View>

            <Skeleton className="h-10 w-full rounded-lg" />
          </View>
        )}

        {/* Independent request error and retry */}
        {error ? (
          <ErrorState
            variant="analytics"
            title={
              data
                ? "Unable to refresh reviews needing replies"
                : "Unable to load reviews needing replies"
            }
            description={
              data
                ? "Previously loaded counts are still shown."
                : "Your reply backlog couldn't be loaded. Please try again."
            }
            primaryActionTitle="Retry"
            onPrimaryAction={onRetry}
          />
        ) : null}

        {/* Current unanswered-review summary */}
        {data && (
          <View testID="analytics-unanswered-content" className="gap-4">
            {data.total_unanswered === 0 ? (
              /* Completed state */
              <View
                accessible
                accessibilityLabel="All caught up. No published reviews need your reply."
                className="flex-row items-center gap-3 rounded-card bg-surface-muted p-4"
              >
                <View className="h-10 w-10 shrink-0 items-center justify-center">
                  <MaterialCommunityIcons
                    name="check-circle-outline"
                    size={27}
                    color={theme.extends.colors.text.secondary}
                    accessible={false}
                  />
                </View>

                <View className="min-w-0 flex-1 gap-1">
                  <AppText
                    weight="bold"
                    className="text-base text-text-primary"
                  >
                    All caught up
                  </AppText>

                  <AppText className="text-sm leading-5 text-text-secondary">
                    No published reviews need your reply right now.
                  </AppText>
                </View>
              </View>
            ) : (
              <>
                {/* Primary unanswered-review metric card */}
                <View
                  accessible
                  accessibilityLabel={`${data.total_unanswered} published reviews awaiting your reply`}
                  className="flex-row items-center gap-4 rounded-xl bg-surface-muted px-4 py-4"
                >
                  <AppText
                    weight="extrabold"
                    className="text-3xl text-text-primary"
                  >
                    {formatAnalyticsCount(data.total_unanswered)}
                  </AppText>

                  <View className="min-w-0 flex-1 gap-1">
                    <AppText
                      weight="semibold"
                      className="text-sm text-text-primary"
                    >
                      Reviews awaiting reply
                    </AppText>

                    <AppText className="text-xs leading-4 text-text-secondary">
                      Published reviews without a response
                    </AppText>
                  </View>
                </View>

                {/* Proportional review-age distribution */}
                <View className="gap-3">
                  {hasAgeCounts && (
                    <View
                      accessible={false}
                      className="h-2.5 flex-row overflow-hidden rounded-full bg-surface-muted"
                    >
                      {groups
                        .filter((group) => group.count > 0)
                        .map((group) => (
                          <View
                            key={group.key}
                            style={{
                              flex: group.count,
                              backgroundColor: group.color,
                            }}
                          />
                        ))}
                    </View>
                  )}

                  {/* Age legend and exact counts */}
                  <View
                    className={
                      stacked
                        ? "gap-3"
                        : "flex-row items-start justify-between gap-3"
                    }
                  >
                    {groups.map((group) => (
                      <View
                        key={group.key}
                        testID={`unanswered-age-group-${group.key}`}
                        accessible
                        accessibilityLabel={`${group.label}: ${group.count} ${
                          group.count === 1 ? "review" : "reviews"
                        }`}
                        className={
                          stacked
                            ? "flex-row items-center justify-between gap-3"
                            : "min-w-0 flex-1 gap-1.5"
                        }
                      >
                        {/* Matching age-color indicator */}
                        <View className="min-w-0 flex-row items-center gap-2">
                          <View
                            accessible={false}
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor: group.color,
                            }}
                          />

                          <AppText className="text-xs text-text-secondary">
                            {group.label}
                          </AppText>
                        </View>

                        {/* Exact count for this age group */}
                        <AppText
                          weight="bold"
                          className={`text-xl ${
                            group.key === "7-plus" && group.count > 0
                              ? "text-brand"
                              : "text-text-primary"
                          }`}
                        >
                          {formatAnalyticsCount(group.count)}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Navigation to oldest unanswered reviews */}
                <SafePressable
                  accessibilityRole="button"
                  accessibilityLabel="Review oldest unanswered reviews first"
                  onPress={onReview}
                  className="min-h-12 flex-row cursor-pointer items-center justify-between gap-3 border-t border-border-primary/60 pt-3 active:opacity-70"
                >
                  <AppText weight="semibold" className="text-sm text-brand">
                    Review oldest first
                  </AppText>

                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={22}
                    color={theme.extends.colors.brand}
                    accessible={false}
                  />
                </SafePressable>
              </>
            )}
          </View>
        )}
      </AnalyticsOverviewSection>

      {/* Review backlog definitions and current-snapshot information */}
      <AnalyticsUnansweredReviewsSheet
        sheetRef={sheetRef}
        snapshotAsOf={data?.snapshot_as_of}
        ageColors={AGE_COLORS}
      />
    </>
  );
}
