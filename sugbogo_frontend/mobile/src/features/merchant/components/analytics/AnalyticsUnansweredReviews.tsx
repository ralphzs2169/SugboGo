import { MaterialCommunityIcons } from "@expo/vector-icons";
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

/** Presents the current reply backlog with a proportional, non-judgmental age distribution. */
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
          label: "Under 3 days",
          count: data.under_3_days,
          color: "bg-surface-muted-strong",
          key: "under-3",
        },
        {
          label: "3–6 days",
          count: data.days_3_to_6,
          color: "bg-brand/50",
          key: "3-to-6",
        },
        {
          label: "7+ days",
          count: data.days_7_plus,
          color: "bg-brand",
          key: "7-plus",
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
              ? `Current snapshot, updated ${formatAnalyticsTimestamp(data.snapshot_as_of)} Manila time`
              : "Current snapshot"
          }
        >
          Current
        </AppText>
      }
    >
      {/* Initial loading and request recovery never hide other Analytics sections. */}
      {loading && !data ? (
        <View
          accessibilityLabel="Loading reviews needing replies"
          accessibilityState={{ busy: true }}
          className="gap-3"
        >
          <Skeleton className="h-7 w-44 rounded" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-12 w-full rounded" />
        </View>
      ) : null}
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

      {data ? (
        <View testID="analytics-unanswered-content">
          {/* Exact current count; zero is a completed state rather than an error. */}
          <View
            accessible
            accessibilityLabel={`${data.total_unanswered} published reviews waiting for your reply`}
            className="flex-row flex-wrap items-center gap-x-3 gap-y-1"
          >
            <AppText weight="bold" className="text-2xl text-text-primary">
              {formatAnalyticsCount(data.total_unanswered)}
            </AppText>
            <AppText className="min-w-0 flex-1 text-sm leading-5 text-text-secondary">
              {data.total_unanswered === 0
                ? "All caught up — no reviews need your reply."
                : "Published reviews waiting for your reply"}
            </AppText>
          </View>
          {data.total_unanswered > 0 ? (
            <>
              {/* Flex weights preserve exact proportions, including small and zero groups. */}
              <View
                accessible={false}
                className="mt-3 h-2 flex-row gap-0.5 overflow-hidden rounded-full"
              >
                {groups
                  .filter((group) => group.count > 0)
                  .map((group) => (
                    <View
                      key={group.key}
                      testID={`unanswered-age-segment-${group.key}`}
                      className={`h-full min-w-0 rounded-sm ${group.color}`}
                      style={{ flexGrow: group.count, flexBasis: 0 }}
                    />
                  ))}
              </View>
              <View className={`mt-2 ${stacked ? "gap-3" : "flex-row gap-4"}`}>
                {groups.map((group) => (
                  <View
                    key={group.key}
                    accessible
                    accessibilityLabel={`${group.label}: ${group.count} reviews`}
                    className={
                      stacked
                        ? "flex-row items-center justify-between"
                        : "min-w-0 flex-1 gap-1"
                    }
                  >
                    <View className="flex-row items-center gap-1.5">
                      <View
                        accessible={false}
                        className={`h-1.5 w-1.5 rounded-full ${group.color}`}
                      />
                      <AppText className="text-xs leading-5 text-text-secondary">
                        {group.label}
                      </AppText>
                    </View>
                    <AppText
                      weight="semibold"
                      className="text-base text-text-primary"
                    >
                      {formatAnalyticsCount(group.count)}
                    </AppText>
                  </View>
                ))}
              </View>
              {/* The action opens the existing merchant tab with an explicit review intent. */}
              <SafePressable
                accessibilityRole="button"
                accessibilityLabel="Review oldest first"
                onPress={onReview}
                className="mt-4 min-h-12 flex-row items-center justify-between gap-3 border-t border-border-primary pt-2 active:opacity-70"
              >
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  Review oldest first
                </AppText>
                <MaterialCommunityIcons
                  accessible={false}
                  name="chevron-right"
                  size={20}
                  color={theme.extends.colors.text.secondary}
                />
              </SafePressable>
            </>
          ) : null}
        </View>
      ) : null}
    </AnalyticsOverviewSection>
  );
}
