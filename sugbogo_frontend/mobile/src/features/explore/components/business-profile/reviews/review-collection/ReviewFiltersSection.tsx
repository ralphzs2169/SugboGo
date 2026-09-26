import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import FilterChip from "@/shared/components/FilterChip";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import type { BusinessReviewInsights } from "../../../../types/exploreBusiness.types";
import type {
  BusinessReviewFilters,
  ReviewSentiment,
} from "../../../../types/review.types";
import VisitorVibeSection from "../VisitorVibeSection";
import ReviewFilterBottomSheet from "./ReviewFilterBottomSheet";

const SORT_OPTIONS = [
  {
    label: "Newest",
    value: "newest",
  },
  {
    label: "Oldest",
    value: "oldest",
  },
  {
    label: "Most liked",
    value: "most_liked",
  },
] as const;

type Props = {
  insights?: BusinessReviewInsights | null;
  insightsLoading: boolean;
  insightsError: boolean;
  onRetryInsights: () => void;
  filters: BusinessReviewFilters;
  onChange: (filters: BusinessReviewFilters) => void;
  onClear: () => void;
};

/**
 * Presents review insights, topic discovery, filtering, and sorting controls.
 *
 * Keeps topic discovery separate from general review controls and only exposes
 * sentiment-based interactions when sufficient classified review data exists.
 */
export default function ReviewFiltersSection({
  insights,
  insightsLoading,
  insightsError,
  onRetryInsights,
  filters,
  onChange,
  onClear,
}: Props) {
  const filterSheetRef = useRef<BottomSheetModal | null>(null);

  const [optionsWidth, setOptionsWidth] = useState(0);
  const [optionsContentWidth, setOptionsContentWidth] = useState(0);
  const [optionsScrollX, setOptionsScrollX] = useState(0);

  const activeFilterCount = [
    filters.sentiment,
    filters.topic,
    filters.hasPhotos,
    filters.merchantReplied,
  ].filter(Boolean).length;

  const hasFrequentMentions = Boolean(insights?.frequent_mentions?.length);

  const hasSufficientSentimentData = Boolean(
    insights?.has_sufficient_sentiment_data,
  );

  const optionsCanScroll = optionsContentWidth > optionsWidth + 1;

  const showLeftFade = optionsCanScroll && optionsScrollX > 4;

  const showRightFade =
    optionsCanScroll && optionsScrollX < optionsContentWidth - optionsWidth - 4;

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

  const toggleHasPhotos = () => {
    onChange({
      ...filters,
      hasPhotos: !filters.hasPhotos,
    });
  };

  const toggleMerchantReplied = () => {
    onChange({
      ...filters,
      merchantReplied: !filters.merchantReplied,
    });
  };

  return (
    <View className="gap-5">
      {/* Visitor vibe */}
      {(insightsLoading || insightsError || hasSufficientSentimentData) && (
        <View>
          <AppText weight="bold" className="text-sm text-text-primary">
            Review Vibe
          </AppText>

          {insightsLoading && (
            <ActivityIndicator
              className="mt-4 self-start"
              color={theme.extends.colors.brand}
            />
          )}

          {insightsError && (
            <View className="mt-3 h-40">
              <ErrorState
                size="section"
                title="Unable to load Visitor Vibe"
                description="Reviews are still available below."
                primaryActionTitle="Retry"
                onPrimaryAction={onRetryInsights}
              />
            </View>
          )}

          {!insightsLoading &&
            !insightsError &&
            hasSufficientSentimentData &&
            insights && (
              <View className="mt-4">
                <VisitorVibeSection
                  insights={insights}
                  selectedSentiment={filters.sentiment}
                  onSentimentPress={toggleSentiment}
                  showDescription
                />
              </View>
            )}
        </View>
      )}

      {/* Frequently mentioned topics */}
      {hasFrequentMentions && insights && (
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

      {/* Review filters and sorting */}
      <View className="mb-4">
        <View className="mb-3 flex-row items-center justify-between">
          <AppText weight="bold" className="text-sm text-text-primary">
            Filter & sort
          </AppText>

          {activeFilterCount > 0 && (
            <Pressable
              onPress={onClear}
              accessibilityRole="button"
              accessibilityLabel="Clear review filters"
              hitSlop={8}
              className="cursor-pointer py-1 active:opacity-70"
            >
              <AppText weight="semibold" className="text-xs text-brand">
                Clear filters
              </AppText>
            </Pressable>
          )}
        </View>

        <View
          className="relative"
          onLayout={(event) => {
            setOptionsWidth(event.nativeEvent.layout.width);
          }}
        >
          <ScrollView
            testID="review-quick-controls"
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onContentSizeChange={(width) => {
              setOptionsContentWidth(width);
            }}
            onScroll={(event) => {
              setOptionsScrollX(event.nativeEvent.contentOffset.x);
            }}
            contentContainerClassName="items-center gap-2 px-1 pr-3"
          >
            {/* Full filter entry */}
            <FilterChip
              label="Filter"
              icon="tune-variant"
              count={activeFilterCount}
              selected={false}
              onPress={() => presentBottomSheet(filterSheetRef)}
              accessibilityLabel={`Filter reviews, ${activeFilterCount} active filters`}
            />

            {/* Quick content filters */}
            <FilterChip
              label="With photos"
              selected={filters.hasPhotos}
              onPress={toggleHasPhotos}
              showSelectedCheck
              accessibilityLabel={`With photos${
                filters.hasPhotos ? ", selected" : ""
              }`}
            />

            <FilterChip
              label="With reply"
              selected={filters.merchantReplied}
              onPress={toggleMerchantReplied}
              showSelectedCheck
              accessibilityLabel={`With reply${
                filters.merchantReplied ? ", selected" : ""
              }`}
            />

            {/* Filter and sort divider */}
            <View className="mx-1 h-6 w-px bg-border-primary" />

            {/* Sort options */}
            {SORT_OPTIONS.map((option) => {
              const selected = filters.ordering === option.value;

              return (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  selected={selected}
                  showSelectedCheck
                  onPress={() =>
                    onChange({
                      ...filters,
                      ordering: option.value,
                    })
                  }
                  accessibilityLabel={`Sort by ${option.label}${
                    selected ? ", selected" : ""
                  }`}
                />
              );
            })}
          </ScrollView>

          {/* Left scroll fade */}
          {showLeftFade && (
            <LinearGradient
              pointerEvents="none"
              colors={[
                theme.extends.colors.background,
                `${theme.extends.colors.background}00`,
              ]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: 32,
                zIndex: 10,
              }}
            />
          )}

          {/* Right scroll fade */}
          {showRightFade && (
            <LinearGradient
              pointerEvents="none"
              colors={[
                `${theme.extends.colors.background}00`,
                theme.extends.colors.background,
              ]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                right: 0,
                width: 32,
                zIndex: 10,
              }}
            />
          )}
        </View>
      </View>

      {/* Full filter controls */}
      <ReviewFilterBottomSheet
        sheetRef={filterSheetRef}
        insights={insights}
        filters={filters}
        onApply={onChange}
      />
    </View>
  );
}
