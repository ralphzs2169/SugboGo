import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import ReviewVibeBadge from "@/shared/components/reviews/ReviewVibeBadge";

import type {
  BusinessReviewInsights,
  ReviewInsightRegeneration,
} from "../../../types/exploreBusiness.types";
import {
  isTrackedReviewInsightRegeneration,
  resolveReviewInsightRegeneration,
  reviewInsightUpdateMessage,
} from "../../../utils/reviewInsightRegeneration.utils";
import ReviewInsightsHeader from "./ReviewInsightsHeader";
import ReviewInsightsStateCard from "./ReviewInsightsStateCard";
import ReviewInsightsSummaryCard from "./ReviewInsightsSummaryCard";

type Props = {
  insights?: BusinessReviewInsights | null;
  regeneration?: ReviewInsightRegeneration | null;
  isLoading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  children?: ReactNode;
};

/**
 * Presents recent generated Review Insights in one compact section.
 *
 * Keeps generated content and regeneration progress independent while
 * simplifying unavailable states so they do not repeat the section heading.
 */
export default function RecentReviewInsightsSection({
  insights,
  regeneration,
  isLoading = false,
  error = false,
  onRetry,
  children,
}: Props) {
  const recentCount = insights?.eligible_review_count ?? 0;
  const hasRecentReviews = recentCount > 0;
  const classifiedCount = insights?.classified_review_count ?? 0;

  const progress = resolveReviewInsightRegeneration(regeneration, insights);
  const tracked = isTrackedReviewInsightRegeneration(progress);
  const updateMessage = reviewInsightUpdateMessage(progress);
  const showGeneratedContent = Boolean(
    insights?.content_available && (progress?.content_available ?? true),
  );

  const showOverallVibe = Boolean(
    insights?.has_sufficient_sentiment_data &&
    classifiedCount > 0 &&
    Object.values(insights.sentiment).some(
      (item) => item.count > 0 && item.percentage > 0,
    ),
  );

  const isUpdating = Boolean(
    !tracked &&
    insights &&
    (insights.state === "pending" || insights.state === "outdated") &&
    !showGeneratedContent,
  );

  const showSectionHeader = showGeneratedContent;

  const overallVibe = showOverallVibe ? insights?.overall_vibe : null;

  return (
    <View className="gap-5 rounded-md bg-surface pb-2">
      {/* Review Insights heading and recent-review context */}
      {showSectionHeader && (
        <ReviewInsightsHeader
          recentCount={recentCount}
          overallVibe={overallVibe}
        />
      )}

      {/* Preserve the overall vibe when generated content has no heading. */}
      {!showSectionHeader && overallVibe && (
        <View className="self-start">
          <ReviewVibeBadge vibe={overallVibe} testID="overall-review-vibe" />
        </View>
      )}

      {/* Loading, error, and unavailable states */}
      {!isLoading && !error && updateMessage && (
        <View
          className="flex-row items-start gap-2"
          testID="insight-update-status"
        >
          <MaterialCommunityIcons
            name="clock-outline"
            size={16}
            color={theme.extends.colors.text.secondary}
          />
          <View className="flex-1 gap-0.5">
            <AppText className="text-xs leading-5 text-text-secondary">
              {updateMessage}
            </AppText>
            {tracked && showGeneratedContent && !progress.content_is_current && (
              <AppText className="text-xs leading-5 text-text-tertiary">
                Showing the previous summary for now.
              </AppText>
            )}
          </View>
        </View>
      )}
      {!isLoading &&
        !error &&
        tracked &&
        showGeneratedContent &&
        !updateMessage &&
        !progress.content_is_current && (
          <AppText className="text-xs leading-5 text-text-secondary">
            Showing the previous summary for now.
          </AppText>
        )}
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
      ) : !showGeneratedContent && updateMessage ? null : !insights ? (
        <ReviewInsightsStateCard
          icon="chart-box-outline"
          title="Recent insights are not available yet"
          description="Insights will appear after recent reviews are processed."
        />
      ) : !showSectionHeader &&
        !isUpdating &&
        insights.state !== "insufficient_reviews" ? (
        <ReviewInsightsStateCard
          icon="chart-box-outline"
          title={
            hasRecentReviews
              ? "Recent insights are not available yet"
              : "No recent insights yet"
          }
          description={
            hasRecentReviews
              ? insights.state_message ||
                "Insights will appear after recent reviews are processed."
              : `At least ${insights.minimum_eligible_review_count} eligible reviews from the past 30 days are needed to generate insights.`
          }
        />
      ) : (
        <>
          {/* Insufficient generated-insight state */}
          {insights.state === "insufficient_reviews" && !showSectionHeader && (
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
          {!tracked && insights.state === "pending" && !isUpdating && (
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

          {!tracked &&
            insights.state === "outdated" &&
            showGeneratedContent && (
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

          {/* Additional generated insight content */}
          {showGeneratedContent && children}
        </>
      )}
    </View>
  );
}
