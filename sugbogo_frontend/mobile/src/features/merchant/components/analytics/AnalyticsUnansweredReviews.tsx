import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Fragment } from "react";
import { View, useWindowDimensions } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";

import type { MerchantUnansweredReviewsSummary } from "../../types/merchantAnalytics.types";
import {
  formatAnalyticsCount,
  formatAnalyticsTimestamp,
} from "../../utils/merchantAnalytics.utils";

import AnalyticsOverviewSection from "./AnalyticsOverviewSection";

type Props = {
  data?: MerchantUnansweredReviewsSummary;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onReview: () => void;
};

/**
 * Displays the current unanswered-review backlog with a prominent
 * total, a compact age breakdown, and direct review navigation.
 *
 * Preserves independent loading, recovery, and empty states without
 * adding another chart to the analytics dashboard.
 */
export default function AnalyticsUnansweredReviews({
  data,
  loading,
  error,
  onRetry,
  onReview,
}: Props) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 340 || fontScale >= 1.5;

  const groups = data
    ? [
        {
          key: "under-3",
          label: "Under 3 days",
          count: data.under_3_days,
        },
        {
          key: "3-to-6",
          label: "3–6 days",
          count: data.days_3_to_6,
        },
        {
          key: "7-plus",
          label: "7+ days",
          count: data.days_7_plus,
        },
      ]
    : [];

  return (
    <AnalyticsOverviewSection
      title="Reviews needing replies"
      accessory={
        <AppText
          className="text-xs text-text-secondary"
          accessibilityLabel={
            data
              ? `Current snapshot, updated ${formatAnalyticsTimestamp(
                  data.snapshot_as_of,
                )} Manila time`
              : "Current snapshot"
          }
        >
          Current
        </AppText>
      }
    >
      {/* Initial loading state */}
      {loading && !data && (
        <View
          accessibilityLabel="Loading reviews needing replies"
          accessibilityState={{ busy: true }}
          className="gap-4 py-2"
        >
          <View className="flex-row items-center gap-3">
            <Skeleton className="h-14 w-16 rounded-lg" />
            <Skeleton className="h-8 w-40 rounded-lg" />
          </View>

          <Skeleton className="h-24 w-full rounded-xl" />

          <Skeleton className="h-12 w-full rounded-lg" />
        </View>
      )}

      {/* Independent request recovery */}
      {error ? (
        <ErrorState
          size="section"
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

      {data && (
        <View testID="analytics-unanswered-content" className="gap-4">
          {data.total_unanswered === 0 ? (
            /* Completed state */
            <View
              accessible
              accessibilityLabel="All caught up. No published reviews need your reply."
              className="flex-row items-center gap-3 py-3"
            >
              <View className="h-12 w-12 shrink-0 items-center justify-center ">
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={25}
                  color={theme.extends.colors.text.secondary}
                  accessible={false}
                />
              </View>

              <View className="min-w-0 flex-1 gap-1">
                <AppText weight="bold" className="text-base text-text-primary">
                  All caught up
                </AppText>

                <AppText className="text-sm leading-5 text-text-secondary">
                  No published reviews need your reply right now.
                </AppText>
              </View>
            </View>
          ) : (
            <>
              {/* Primary unanswered-review count */}
              <View
                accessible
                accessibilityLabel={`${data.total_unanswered} published reviews waiting for your reply`}
                className="flex-row items-center gap-4 py-1"
              >
                <AppText
                  weight="extrabold"
                  className="text-4xl text-text-primary"
                >
                  {formatAnalyticsCount(data.total_unanswered)}
                </AppText>

                <View className="min-w-0 flex-1">
                  <AppText className="text-sm leading-5 text-text-secondary">
                    Published reviews awaiting your reply
                  </AppText>
                </View>

                <View className="h-11 w-11 shrink-0 items-center justify-center">
                  <MaterialCommunityIcons
                    name="comment-text-outline"
                    size={23}
                    color={theme.extends.colors.text.secondary}
                    accessible={false}
                  />
                </View>
              </View>

              {/* Grouped age statistics without another chart */}
              <View className="rounded-xl bg-surface-muted px-3 py-3">
                <View className={stacked ? "gap-2" : "flex-row items-stretch"}>
                  {groups.map((group, index) => {
                    const highlight = group.key === "7-plus" && group.count > 0;

                    return (
                      <Fragment key={group.key}>
                        {index > 0 && (
                          <View
                            accessible={false}
                            className={
                              stacked
                                ? "h-px bg-border-primary/60"
                                : "mx-1 w-px self-stretch bg-border-primary/60"
                            }
                          />
                        )}

                        <View
                          testID={`unanswered-age-group-${group.key}`}
                          accessible
                          accessibilityLabel={`${group.label}: ${group.count} ${
                            group.count === 1 ? "review" : "reviews"
                          }`}
                          className={
                            stacked
                              ? "flex-row items-center justify-between gap-3 px-2 py-2"
                              : "min-w-0 flex-1 items-center gap-1 px-1 py-1"
                          }
                        >
                          <AppText
                            weight="bold"
                            className={`text-2xl ${
                              highlight ? "text-brand" : "text-text-primary"
                            }`}
                          >
                            {formatAnalyticsCount(group.count)}
                          </AppText>

                          <AppText
                            className={`text-xs leading-5 text-text-secondary ${
                              stacked ? "text-right" : "text-center"
                            }`}
                          >
                            {group.label}
                          </AppText>
                        </View>
                      </Fragment>
                    );
                  })}
                </View>
              </View>

              {/* Primary action to resolve the oldest unanswered reviews */}
              <SafePressable
                accessibilityRole="button"
                accessibilityLabel="Review oldest unanswered reviews first"
                onPress={onReview}
                className="min-h-12 flex-row cursor-pointer items-center justify-between gap-3 border-t border-border-primary/60 pt-3 active:opacity-70"
              >
                <AppText weight="semibold" className="text-sm text-brand">
                  Review oldest first
                </AppText>

                <View className="h-8 w-8 items-center justify-center rounded-full bg-brand/10">
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={21}
                    color={theme.extends.colors.brand}
                    accessible={false}
                  />
                </View>
              </SafePressable>
            </>
          )}
        </View>
      )}
    </AnalyticsOverviewSection>
  );
}
