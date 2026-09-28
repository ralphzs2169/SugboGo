import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";

import type { BusinessReviewInsights } from "../../../types/exploreBusiness.types";
import type { ReviewSentiment } from "../../../types/review.types";
import ReviewInsightsHeader from "./ReviewInsightsHeader";
import ReviewInsightsStateCard from "./ReviewInsightsStateCard";
import ReviewInsightsSummaryCard from "./ReviewInsightsSummaryCard";
import ReviewVibeSection from "./ReviewVibeSection";

type Props = {
  insights?: BusinessReviewInsights | null;
  isLoading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  selectedSentiment?: ReviewSentiment | null;
  onSentimentPress?: (sentiment: ReviewSentiment) => void;
  children?: ReactNode;
};

/**
 * Presents recent generated Review Insights and sentiment in one compact section.
 *
 * Keeps generated content and sentiment availability independent while
 * simplifying unavailable states so they do not repeat the section heading.
 */
export default function RecentReviewInsightsSection({
  insights,
  isLoading = false,
  error = false,
  onRetry,
  selectedSentiment,
  onSentimentPress,
  children,
}: Props) {
  const recentCount = insights?.eligible_review_count ?? 0;
  const hasRecentReviews = recentCount > 0;

  const showGeneratedContent = Boolean(insights?.content_available);

  const showSentiment = Boolean(
    hasRecentReviews &&
    insights?.has_sufficient_sentiment_data &&
    insights.overall_vibe,
  );

  const isUpdating = Boolean(
    insights &&
      (insights.state === "pending" || insights.state === "outdated") &&
      !showGeneratedContent,
  );

  const showSectionHeader = showGeneratedContent || showSentiment;

  const overallVibe = showSentiment ? insights?.overall_vibe : null;

  return (
    <View className="gap-5 rounded-md bg-surface pb-2">
      {/* Review Insights heading and recent-review context */}
      {showSectionHeader && (
        <ReviewInsightsHeader
          recentCount={recentCount}
          overallVibe={overallVibe}
        />
      )}

      {/* Loading, error, and unavailable states */}
      {isLoading ? (
        <ActivityIndicator
          className="self-start"
          color={theme.extends.colors.brand}
        />
      ) : error ? (
        <View className="h-40">
          <ErrorState
            size="section"
            title="Unable to load recent insights"
            description="Reviews are still available below."
            primaryActionTitle="Retry"
            onPrimaryAction={onRetry}
          />
        </View>
      ) : !insights ? (
        <ReviewInsightsStateCard
          icon="chart-box-outline"
          title="Recent insights are not available yet"
          description="Insights will appear after recent reviews are processed."
        />
      ) : !hasRecentReviews && !isUpdating ? (
        <ReviewInsightsStateCard
          icon="chart-box-outline"
          title="No recent insights yet"
          description="At least 5 eligible reviews from the past 30 days are needed to generate insights."
        />
      ) : (
        <>
          {/* Insufficient generated-insight state */}
          {insights.state === "insufficient_reviews" && (
            <ReviewInsightsStateCard
              icon="chart-box-outline"
              title="Not enough recent reviews yet"
              description={insights.state_message ?? ""}
            />
          )}

          {/* Generated-insight refresh state */}
          {isUpdating && (
            <ReviewInsightsStateCard
              icon="refresh"
              title="Updating insights…"
              description={
                insights.state_message ||
                "Recent reviews changed, so we’re refreshing this summary."
              }
            />
          )}

          {/* Generation freshness messages */}
          {insights.state === "pending" && !isUpdating && (
            <View className="flex-row items-start gap-2">
              <MaterialCommunityIcons
                name="clock-outline"
                size={16}
                color={theme.extends.colors.text.secondary}
              />

              <AppText className="flex-1 text-xs leading-5 text-text-secondary">
                {insights.state_message}
              </AppText>
            </View>
          )}

          {insights.state === "outdated" && showGeneratedContent && (
            <View className="flex-row items-start gap-2">
              <MaterialCommunityIcons
                name="clock-alert-outline"
                size={16}
                color={theme.extends.colors.text.secondary}
              />

              <AppText className="flex-1 text-xs leading-5 text-text-secondary">
                {insights.state_message}
              </AppText>
            </View>
          )}

          {/* Generated Vibe Summary */}
          {showGeneratedContent && insights.narrative && (
            <ReviewInsightsSummaryCard
              narrative={insights.narrative}
              footer={
                insights.is_sampled ? (
                  <AppText className="mt-2 text-xs leading-5 text-text-tertiary">
                    Based on {insights.analyzed_review_count} of {recentCount}{" "}
                    eligible recent reviews.
                  </AppText>
                ) : null
              }
            />
          )}

          {/* Recent sentiment distribution */}
          {showSentiment && (
            <ReviewVibeSection
              insights={insights}
              selectedSentiment={selectedSentiment}
              onSentimentPress={onSentimentPress}
              showDescription={false}
            />
          )}

          {/* Additional generated insight content */}
          {showGeneratedContent && children}
        </>
      )}
    </View>
  );
}
