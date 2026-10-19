import { View } from "react-native";

import FilterChip from "@/shared/components/FilterChip";
import FilterSortControls from "@/shared/components/filters/FilterSortControls";

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
  const activeFilterCount = [
    filters.sentiment,
    filters.topic,
    filters.hasPhotos,
    filters.merchantReplied,
  ].filter(Boolean).length;

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
    <FilterSortControls
      activeFilterCount={activeFilterCount}
      onClear={onClear}
      testID="review-quick-controls"
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
    </FilterSortControls>
  );
}
