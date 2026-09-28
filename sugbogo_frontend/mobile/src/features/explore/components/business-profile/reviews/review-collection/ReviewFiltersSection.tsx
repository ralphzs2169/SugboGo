import { useEffect } from "react";
import { ScrollView, View } from "react-native";

import AppText from "@/shared/components/AppText";
import FilterChip from "@/shared/components/FilterChip";

import type { BusinessReviewInsights } from "../../../../types/exploreBusiness.types";
import type {
  BusinessReviewFilters,
  ReviewSentiment,
} from "../../../../types/review.types";
import RecentReviewInsightsSection from "../RecentReviewInsightsSection";
import ReviewFilterControls from "./ReviewFilterControls";

type Props = {
  insights?: BusinessReviewInsights | null;
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

  const toggleSentiment = (sentiment: ReviewSentiment) => {
    onChange({
      ...filters,
      sentiment: filters.sentiment === sentiment ? null : sentiment,
    });
  };

  const toggleTopic = (topic: string) => {
    onChange({
      ...filters,
      topic: filters.topic === topic ? null : topic,
    });
  };

  return (
    <View className="gap-5 pt-5">
      {/* Recent insights and evidence-backed topic filters */}
      <RecentReviewInsightsSection
        insights={insights}
        isLoading={insightsLoading}
        error={insightsError}
        onRetry={onRetryInsights}
        selectedSentiment={filters.sentiment}
        onSentimentPress={toggleSentiment}
      >
        {insights && insights.frequent_mentions.length > 0 && (
          <View>
            <AppText weight="bold" className="mb-3 text-sm text-text-primary">
              Frequently mentioned
            </AppText>

            <ScrollView
              testID="review-topic-filters"
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="items-center gap-2 px-1 pr-3"
            >
              {insights.frequent_mentions.map((mention) => (
                <FilterChip
                  key={mention.label}
                  label={mention.label}
                  count={mention.count}
                  selected={filters.topic === mention.label}
                  onPress={() => toggleTopic(mention.label)}
                  accessibilityLabel={`${mention.label}, mentioned in ${
                    mention.count
                  } ${mention.count === 1 ? "review" : "reviews"}${
                    filters.topic === mention.label ? ", selected" : ""
                  }`}
                />
              ))}
            </ScrollView>
          </View>
        )}
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
