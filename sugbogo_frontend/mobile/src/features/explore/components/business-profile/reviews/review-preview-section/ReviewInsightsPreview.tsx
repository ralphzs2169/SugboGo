import { View } from "react-native";

import AppText from "@/shared/components/AppText";

import type {
  BusinessReviewInsights,
  ReviewInsightRegeneration,
} from "../../../../types/exploreBusiness.types";
import {
  isTrackedReviewInsightRegeneration,
  resolveReviewInsightRegeneration,
  reviewInsightUpdateMessage,
} from "../../../../utils/reviewInsightRegeneration.utils";
import ReviewInsightsSummaryCard from "../ReviewInsightsSummaryCard";

type Props = {
  insights?: BusinessReviewInsights | null;
  regeneration?: ReviewInsightRegeneration | null;
};

/**
 * Shows the business profile's compact Review Insights preview.
 *
 * Shows useful generated content without empty or unavailable status panels.
 */
export default function ReviewInsightsPreview({
  insights,
  regeneration,
}: Props) {
  const recentCount = insights?.eligible_review_count ?? 0;
  const progress = resolveReviewInsightRegeneration(regeneration, insights);
  const tracked = isTrackedReviewInsightRegeneration(progress);
  const updateMessage = reviewInsightUpdateMessage(progress);

  const hasGeneratedSummary = Boolean(
    insights?.content_available &&
    (progress?.content_available ?? true) &&
    insights.narrative,
  );

  if (
    !insights ||
    !hasGeneratedSummary ||
    recentCount === 0 ||
    insights.state === "insufficient_reviews"
  ) {
    return null;
  }

  const overallVibe =
    insights?.has_sufficient_sentiment_data && insights.overall_vibe
      ? insights.overall_vibe
      : null;

  return (
    <View className="mb-5">
      {tracked && hasGeneratedSummary && !progress.content_is_current && (
        <View className="mb-2 gap-0.5">
          {updateMessage && (
            <AppText className="text-xs leading-5 text-text-secondary">
              {updateMessage}
            </AppText>
          )}
          <AppText className="text-xs leading-5 text-text-tertiary">
            Showing the previous summary for now.
          </AppText>
        </View>
      )}
      {/* Generated Vibe Summary */}
      <ReviewInsightsSummaryCard
        narrative={insights.narrative!}
        overallVibe={overallVibe}
        footer={
          <View>
            <AppText className="text-xs leading-5 text-text-tertiary">
              Based on {recentCount} eligible{" "}
              {recentCount === 1 ? "review" : "reviews"} from the past 30 days.
            </AppText>

            {!tracked &&
              insights.state === "outdated" &&
              insights.state_message && (
                <AppText className="mt-1 text-xs leading-5 text-text-tertiary">
                  {insights.state_message}
                </AppText>
              )}
          </View>
        }
      />
    </View>
  );
}
