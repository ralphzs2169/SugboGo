import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";
import Skeleton from "@/shared/components/Skeleton";
import ErrorState from "@/shared/components/ErrorState";
import ReviewVibeBadge from "@/shared/components/reviews/ReviewVibeBadge";
import type { PlusStoredInsightsReport } from "../../types/merchantAdvancedAnalytics.types";
import AnalyticsOverviewSection from "./AnalyticsOverviewSection";
import AnalyticsChartEmptyState from "./AnalyticsChartEmptyState";

function reviewDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
}

/** Read-only excerpt of the same stored insights used by the full report, with its original dates. */
export default function AnalyticsReviewSummaryPreview({
  report,
  loading,
  error,
  onRetry,
  onOpen,
}: {
  report?: PlusStoredInsightsReport;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onOpen: () => void;
}) {
  const summary = report?.stored_summary;
  const pending = loading && !report;
  const unavailable = report?.meta.availability === "unavailable";
  const hasContent =
    !unavailable &&
    summary?.content_available &&
    Boolean(summary.narrative?.trim());
  return (
    <AnalyticsOverviewSection
      title="Review summary"
      description="What customers mention in their reviews"
    >
      <View className="gap-4">
        {Boolean(error) && (
          <ErrorState
            variant="analytics"
            title={
              report
                ? "Unable to refresh review summary"
                : "Unable to load review summary"
            }
            description={
              report
                ? "Previously loaded information is still shown."
                : "Please try this section again."
            }
            primaryActionTitle="Retry"
            onPrimaryAction={onRetry}
          />
        )}
        {pending ? (
          <View
            accessibilityLabel="Loading review summary"
            accessibilityState={{ busy: true }}
            className="gap-4 rounded-card bg-surface-muted p-4"
          >
            <View className="flex-row flex-wrap justify-between gap-3">
              <AppText className="text-xs text-text-secondary">
                AI-generated summary
              </AppText>
              <Skeleton className="h-6 w-28 rounded-full" />
            </View>
            <Skeleton className="h-3 w-48 max-w-full rounded" />
            <View className="gap-2">
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-4/5 rounded" />
            </View>
            <Skeleton className="h-3 w-28 rounded" />
          </View>
        ) : unavailable ? (
          !error && (
            <ErrorState
              variant="analytics"
              title="Review summary unavailable"
              description="The stored summary could not be loaded."
              primaryActionTitle="Retry"
              onPrimaryAction={onRetry}
            />
          )
        ) : hasContent && summary ? (
          <View className="gap-3 rounded-card bg-surface-muted p-4">
            <View className="flex-row flex-wrap items-center justify-between gap-3">
              <View className="flex-row items-center gap-1.5">
                <MaterialCommunityIcons
                  name="creation"
                  size={14}
                  color={theme.extends.colors.text.secondary}
                  accessible={false}
                />
                <AppText className="text-xs text-text-secondary">
                  AI-generated summary
                </AppText>
              </View>
              {summary.has_sufficient_sentiment_data && (
                <ReviewVibeBadge vibe={summary.overall_vibe} />
              )}
            </View>
            <AppText className="text-xs leading-5 text-text-secondary">
              {summary.coverage_start && summary.coverage_end
                ? `Review dates: ${reviewDate(summary.coverage_start)} - ${reviewDate(summary.coverage_end)}`
                : "Review dates unavailable"}
            </AppText>
            {summary.state === "outdated" && (
              <View className="flex-row items-start gap-2">
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={16}
                  color={theme.extends.colors.text.secondary}
                  accessible={false}
                />
                <AppText className="min-w-0 flex-1 text-xs leading-5 text-text-secondary">
                  This summary needs updating; recent changes may not be
                  reflected.
                </AppText>
              </View>
            )}
            <AppText
              numberOfLines={4}
              ellipsizeMode="tail"
              className="text-base leading-6 text-text-primary"
            >
              {summary.narrative}
            </AppText>
            <AppText className="text-xs text-text-secondary">
              Based on {summary.analyzed_review_count.toLocaleString("en-PH")}{" "}
              {summary.analyzed_review_count === 1 ? "review" : "reviews"}
              {summary.is_sampled ? " - Sampled" : ""}
            </AppText>
          </View>
        ) : report && !error ? (
          <AnalyticsChartEmptyState
            icon="comment-text-outline"
            title={
              summary?.state === "pending"
                ? "Review summary is being prepared"
                : summary?.state === "insufficient_reviews"
                  ? "More reviews are needed"
                  : "No review summary yet"
            }
            description={
              summary?.state === "insufficient_reviews"
                ? `At least ${summary.minimum_eligible_review_count} qualifying reviews are needed.`
                : "A prepared summary will appear here when it is available."
            }
          />
        ) : null}
        <SafePressable
          accessibilityRole="button"
          accessibilityLabel="Read review insights"
          accessibilityHint="Opens the complete stored summary, common mentions, and measurement details"
          onPress={onOpen}
          className="min-h-11 cursor-pointer flex-row items-center gap-1 self-start active:opacity-70"
        >
          <AppText weight="semibold" className="text-sm text-brand">
            Read review insights
          </AppText>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={theme.extends.colors.brand}
            accessible={false}
          />
        </SafePressable>
      </View>
    </AnalyticsOverviewSection>
  );
}
