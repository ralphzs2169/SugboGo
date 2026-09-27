import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import type { RefObject } from "react";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import FilterChip from "@/shared/components/FilterChip";

import type { BusinessReviewInsights } from "../../../../types/exploreBusiness.types";
import type {
  BusinessReviewFilters,
  ReviewSentiment,
} from "../../../../types/review.types";

const SENTIMENT_OPTIONS: {
  label: string;
  value: ReviewSentiment;
}[] = [
  {
    label: "Positive",
    value: "positive",
  },
  {
    label: "Neutral",
    value: "neutral",
  },
  {
    label: "Negative",
    value: "negative",
  },
];

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
  sheetRef: RefObject<BottomSheetModal | null>;
  insights?: BusinessReviewInsights | null;
  filters: BusinessReviewFilters;
  onApply: (filters: BusinessReviewFilters) => void;
};

/**
 * Presents staged review filtering and sorting controls in a bottom sheet.
 *
 * Keeps selections local until applied and only exposes sentiment filtering
 * when the backend reports sufficient classified review data.
 */
export default function ReviewFilterBottomSheet({
  sheetRef,
  insights,
  filters,
  onApply,
}: Props) {
  const insets = useSafeAreaInsets();

  const canFilterBySentiment = Boolean(insights?.has_sufficient_sentiment_data);

  const [draftFilters, setDraftFilters] =
    useState<BusinessReviewFilters>(filters);

  const hasDraftFilters = Boolean(
    draftFilters.sentiment ||
    draftFilters.topic ||
    draftFilters.hasPhotos ||
    draftFilters.merchantReplied,
  );

  const handleClear = () => {
    setDraftFilters((current) => ({
      ...current,
      sentiment: null,
      topic: null,
      hasPhotos: false,
      merchantReplied: false,
    }));
  };

  const handleApply = () => {
    onApply({
      ...draftFilters,
      sentiment: canFilterBySentiment ? draftFilters.sentiment : null,
    });

    sheetRef.current?.dismiss();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={["75%"]}
      enableDynamicSizing={false}
      enablePanDownToClose
      onChange={(index) => {
        if (index === 0) {
          setDraftFilters({
            ...filters,
            sentiment: canFilterBySentiment ? filters.sentiment : null,
          });
        }
      }}
      backgroundStyle={{
        backgroundColor: theme.extends.colors.surface,
        borderRadius: 24,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.extends.colors.text.disabled,
        width: 40,
      }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
        />
      )}
    >
      <View className="flex-1">
        {/* Scrollable filter content */}
        <BottomSheetScrollView
          style={{ flex: 1 }}
          contentContainerClassName="px-5 pb-6"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View>
            <AppText weight="bold" className="text-xl text-text-primary">
              Filter reviews
            </AppText>

            <AppText className="mt-1 text-sm text-text-secondary">
              Refine which reviews you want to see.
            </AppText>
          </View>

          {/* Sentiment filters */}
          {canFilterBySentiment && (
            <View className="pt-6">
              <AppText
                weight="semibold"
                className="text-base text-text-primary"
              >
                Vibe
              </AppText>

              <View className="mt-3 flex-row flex-wrap gap-2">
                {SENTIMENT_OPTIONS.map((option) => {
                  const selected = draftFilters.sentiment === option.value;

                  return (
                    <FilterChip
                      key={option.value}
                      label={option.label}
                      selected={selected}
                      showSelectedCheck
                      onPress={() =>
                        setDraftFilters((current) => ({
                          ...current,
                          sentiment:
                            current.sentiment === option.value
                              ? null
                              : option.value,
                        }))
                      }
                      accessibilityLabel={`Filter by ${option.label} sentiment${
                        selected ? ", selected" : ""
                      }`}
                    />
                  );
                })}
              </View>
            </View>
          )}

          {/* Frequently mentioned topics */}
          {!!insights?.frequent_mentions.length && (
            <View className="pt-6">
              <AppText
                weight="semibold"
                className="text-base text-text-primary"
              >
                Frequently mentioned
              </AppText>

              <View className="mt-3 flex-row flex-wrap gap-2">
                {insights.frequent_mentions.map((mention) => {
                  const selected = draftFilters.topic === mention.label;

                  return (
                    <FilterChip
                      key={mention.label}
                      label={mention.label}
                      count={mention.count}
                      selected={selected}
                      showSelectedCheck
                      onPress={() =>
                        setDraftFilters((current) => ({
                          ...current,
                          topic:
                            current.topic === mention.label
                              ? null
                              : mention.label,
                        }))
                      }
                      accessibilityLabel={`Filter by ${mention.label}${
                        selected ? ", selected" : ""
                      }`}
                    />
                  );
                })}
              </View>
            </View>
          )}

          {/* Review content filters */}
          <View className="pt-6">
            <AppText weight="semibold" className="text-base text-text-primary">
              More filters
            </AppText>

            <View className="mt-3 flex-row flex-wrap gap-2">
              <FilterChip
                label="With photos"
                icon="image-outline"
                selected={draftFilters.hasPhotos}
                showSelectedCheck
                onPress={() =>
                  setDraftFilters((current) => ({
                    ...current,
                    hasPhotos: !current.hasPhotos,
                  }))
                }
                accessibilityLabel={`With photos${
                  draftFilters.hasPhotos ? ", selected" : ""
                }`}
              />

              <FilterChip
                label="With reply"
                selected={draftFilters.merchantReplied}
                showSelectedCheck
                onPress={() =>
                  setDraftFilters((current) => ({
                    ...current,
                    merchantReplied: !current.merchantReplied,
                  }))
                }
                accessibilityLabel={`With reply${
                  draftFilters.merchantReplied ? ", selected" : ""
                }`}
              />
            </View>
          </View>

          {/* Sorting */}
          <View className="pt-6">
            <AppText weight="semibold" className="text-base text-text-primary">
              Sort by
            </AppText>

            <View className="mt-3 flex-row flex-wrap gap-2">
              {SORT_OPTIONS.map((option) => {
                const selected = draftFilters.ordering === option.value;

                return (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    selected={selected}
                    showSelectedCheck
                    onPress={() =>
                      setDraftFilters((current) => ({
                        ...current,
                        ordering: option.value,
                      }))
                    }
                    accessibilityLabel={`Sort by ${
                      option.label
                    }${selected ? ", selected" : ""}`}
                  />
                );
              })}
            </View>
          </View>
        </BottomSheetScrollView>

        {/* Fixed sheet actions */}
        <View
          className="flex-row gap-3 border-t border-border-primary bg-surface px-5 pt-3"
          style={{
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          <Button
            title="Clear"
            variant="outline"
            rounded="full"
            size="sm"
            disabled={!hasDraftFilters}
            onPress={handleClear}
            className="flex-1"
            accessibilityLabel="Clear review filters"
          />

          <Button
            title="Apply"
            variant="primary"
            rounded="full"
            size="sm"
            onPress={handleApply}
            className="flex-1"
            accessibilityLabel="Apply review filters"
          />
        </View>
      </View>
    </BottomSheetModal>
  );
}
