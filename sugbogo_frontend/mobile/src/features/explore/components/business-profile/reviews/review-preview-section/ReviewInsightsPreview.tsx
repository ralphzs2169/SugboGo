import { View } from "react-native";

import AppText from "@/shared/components/AppText";

import type { BusinessReviewInsights } from "../../../../types/exploreBusiness.types";
import ReviewInsightsStateCard from "../ReviewInsightsStateCard";
import ReviewInsightsSummaryCard from "../ReviewInsightsSummaryCard";

type Props = {
  insights?: BusinessReviewInsights | null;
};

/**
 * Shows the business profile's compact Review Insights preview.
 *
 * Keeps Reviews as the profile's main section heading while making unavailable,
 * insufficient, and updating states explicitly identifiable as Review Insights.
 */
export default function ReviewInsightsPreview({ insights }: Props) {
  const recentCount = insights?.eligible_review_count ?? 0;
  const hasRecentReviews = recentCount > 0;

  const hasGeneratedSummary = Boolean(
    insights?.content_available && insights.narrative,
  );

  const isUpdating = Boolean(
    insights &&
    (insights.state === "pending" || insights.state === "outdated") &&
    !insights.content_available,
  );

  const overallVibe =
    insights?.has_sufficient_sentiment_data && insights.overall_vibe
      ? insights.overall_vibe
      : null;

  return (
    <View className="mb-5">
      {/* Review Insights availability and generation states */}
      {!insights ? (
        <ReviewInsightsStateCard
          icon="chart-box-outline"
          title="Review Insights aren't available yet"
          description="Insights will appear after recent reviews are processed."
        />
      ) : !hasRecentReviews && !isUpdating ? (
        <ReviewInsightsStateCard
          icon="chart-box-outline"
          title="No Review Insights yet"
          description="At least 5 eligible reviews from the past 30 days are needed to generate insights."
        />
      ) : insights.state === "insufficient_reviews" ? (
        <ReviewInsightsStateCard
          icon="chart-box-outline"
          title="Not enough reviews for Review Insights"
          description={insights.state_message ?? ""}
        />
      ) : isUpdating ? (
        <ReviewInsightsStateCard
          icon="refresh"
          title="Updating Review Insights…"
          description={
            insights.state_message ||
            "Recent reviews changed, so we’re refreshing this summary."
          }
        />
      ) : hasGeneratedSummary ? (
        /* Generated Vibe Summary */
        <ReviewInsightsSummaryCard
          narrative={insights.narrative!}
          overallVibe={overallVibe}
          footer={
            <View>
              <AppText className="text-xs leading-5 text-text-tertiary">
                Based on {recentCount} eligible{" "}
                {recentCount === 1 ? "review" : "reviews"} from the past 30
                days.
              </AppText>

              {insights.state === "outdated" && insights.state_message && (
                <AppText className="mt-1 text-xs leading-5 text-text-tertiary">
                  {insights.state_message}
                </AppText>
              )}
            </View>
          }
        />
      ) : (
        /* Fallback Review Insights state */
        <ReviewInsightsStateCard
          icon="chart-box-outline"
          title="Review Insights aren't available yet"
          description={
            insights.state_message ||
            "Insights will appear after recent reviews are processed."
          }
        />
      )}
    </View>
  );
}
