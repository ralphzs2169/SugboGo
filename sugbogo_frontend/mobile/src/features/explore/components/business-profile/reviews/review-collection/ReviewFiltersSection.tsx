import { useEffect } from "react";
import { View } from "react-native";

import ReviewMentionedAspects from "@/shared/components/reviews/ReviewMentionedAspects";

import type {
  BusinessReviewInsights,
  ReviewInsightRegeneration,
} from "../../../../types/exploreBusiness.types";
import type { BusinessReviewFilters } from "../../../../types/review.types";
import RecentReviewInsightsSection from "../RecentReviewInsightsSection";
import ReviewFilterControls from "./ReviewFilterControls";

type Props = {
  insights?: BusinessReviewInsights | null;
  regeneration?: ReviewInsightRegeneration | null;
  insightsLoading: boolean;
  insightsError: boolean;
  onRetryInsights: () => void;
  filters: BusinessReviewFilters;
  onChange: (filters: BusinessReviewFilters) => void;
  onClear: () => void;
  onOpenFilter: () => void;
  onFilterControlsLayout?: (offsetY: number) => void;
  showReviewControls?: boolean;
};

/**
 * Presents review insights, topic discovery, and review controls.
 *
 * Keeps generated topic discovery separate from reusable filter controls while
 * reporting the controls' position for the screen-level sticky-header behavior.
 */
export default function ReviewFiltersSection({
  insights,
  regeneration,
  insightsLoading,
  insightsError,
  onRetryInsights,
  filters,
  onChange,
  onClear,
  onOpenFilter,
  onFilterControlsLayout,
  showReviewControls = true,
}: Props) {
  const hasSufficientSentimentData = Boolean(
    insights?.has_sufficient_sentiment_data,
  );

  useEffect(() => {
    if (
      !insightsLoading &&
      !insightsError &&
      !hasSufficientSentimentData &&
      filters.sentiment
    ) {
      onChange({
        ...filters,
        sentiment: null,
      });
    }
  }, [
    filters,
    hasSufficientSentimentData,
    insightsError,
    insightsLoading,
    onChange,
  ]);

  return (
    <View className="gap-5 pt-5">
      {/* Recent insights and evidence-backed topic filters */}
      <RecentReviewInsightsSection
        hideUnavailable={insights?.state !== "insufficient_reviews"}
        insights={insights}
        regeneration={regeneration}
        isLoading={insightsLoading}
        error={insightsError}
        onRetry={onRetryInsights}
      >
        <ReviewMentionedAspects
          mentions={insights?.frequent_mentions ?? []}
          selected={filters.topic}
          onChange={(topic) => onChange({ ...filters, topic })}
        />
      </RecentReviewInsightsSection>

      {/* Inline review filtering and sorting */}
      {showReviewControls && (
        <View
          className="mb-4"
          onLayout={(event) => {
            onFilterControlsLayout?.(event.nativeEvent.layout.y);
          }}
        >
          <ReviewFilterControls
            filters={filters}
            onChange={onChange}
            onClear={onClear}
            onOpenFilter={onOpenFilter}
          />
        </View>
      )}
    </View>
  );
}
