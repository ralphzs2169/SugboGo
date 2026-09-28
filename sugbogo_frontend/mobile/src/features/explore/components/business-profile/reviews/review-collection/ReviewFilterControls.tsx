import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import FilterChip from "@/shared/components/FilterChip";

import type { BusinessReviewFilters } from "../../../../types/review.types";

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
  filters: BusinessReviewFilters;
  onChange: (filters: BusinessReviewFilters) => void;
  onClear: () => void;
  onOpenFilter: () => void;
};

/**
 * Displays the reusable review filtering and sorting controls.
 *
 * Supports quick content filters, sorting, full-filter access, and horizontal
 * overflow indicators so the same controls can appear inline or sticky.
 */
export default function ReviewFilterControls({
  filters,
  onChange,
  onClear,
  onOpenFilter,
}: Props) {
  const [optionsWidth, setOptionsWidth] = useState(0);
  const [optionsContentWidth, setOptionsContentWidth] = useState(0);
  const [optionsScrollX, setOptionsScrollX] = useState(0);

  const activeFilterCount = [
    filters.sentiment,
    filters.topic,
    filters.hasPhotos,
    filters.merchantReplied,
  ].filter(Boolean).length;

  const optionsCanScroll = optionsContentWidth > optionsWidth + 1;
  const showLeftFade = optionsCanScroll && optionsScrollX > 4;
  const showRightFade =
    optionsCanScroll && optionsScrollX < optionsContentWidth - optionsWidth - 4;

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
    <View>
      {/* Filter heading and reset action */}
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

      {/* Quick filtering and sorting controls */}
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
          <FilterChip
            label="Filter"
            icon="tune-variant"
            count={activeFilterCount}
            selected={false}
            onPress={onOpenFilter}
            accessibilityLabel={`Filter reviews, ${activeFilterCount} active filters`}
          />

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

          <View className="mx-1 h-6 w-px bg-border-primary" />

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

        {/* Horizontal overflow indicators */}
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
  );
}
