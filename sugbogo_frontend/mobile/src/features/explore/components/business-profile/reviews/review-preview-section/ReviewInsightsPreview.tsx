import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type { BusinessReviewInsights } from "../../../../types/exploreBusiness.types";
import ReviewInsightsStateCard from "../ReviewInsightsStateCard";
import ReviewInsightsSummaryCard from "../ReviewInsightsSummaryCard";

type Props = {
  insights?: BusinessReviewInsights | null;
};

/**
 * Shows the business profile's compact takeaway from recent Review Insights.
 *
 * Keeps Reviews as the profile's single umbrella heading and places the
 * generated summary, overall vibe, and recent-review context in one card.
 */
export default function ReviewInsightsPreview({ insights }: Props) {
  const recentCount = insights?.eligible_review_count ?? 0;
  const hasRecentReviews = recentCount > 0;

  const hasGeneratedSummary = Boolean(
    insights?.content_available && insights.narrative,
  );

  const isUpdating =
    insights?.state === "outdated" && !insights.content_available;

  const overallVibe =
    insights?.has_sufficient_sentiment_data && insights.overall_vibe
      ? insights.overall_vibe
      : null;

  return (
    <View className="mb-5">
      {/* Empty, insufficient, and generation states */}
      {!insights ? (
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
      ) : insights.state === "insufficient_reviews" ? (
        <ReviewInsightsStateCard
          icon="chart-box-outline"
          title="Not enough recent reviews yet"
          description={insights.state_message ?? ""}
        />
      ) : isUpdating ? (
        <ReviewInsightsStateCard
          icon="refresh"
          title="Updating insights…"
          description="We’re refreshing these insights based on the latest reviews."
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
      ) : insights.state === "pending" ? (
        /* Pending generation state */
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
      ) : (
        /* Fallback insight state */
        <AppText className="text-xs leading-5 text-text-secondary">
          {insights.state_message}
        </AppText>
      )}
    </View>
  );
}
