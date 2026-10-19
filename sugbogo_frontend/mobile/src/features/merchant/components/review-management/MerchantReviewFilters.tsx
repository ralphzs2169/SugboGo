import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import FilterChip from "@/shared/components/FilterChip";
import FilterSortControls from "@/shared/components/filters/FilterSortControls";
import { theme } from "@/constants/theme";
import type {
  MerchantReviewFilter,
  MerchantReviewOrdering,
} from "../../types/merchantReviews.types";

export type ReviewFilter = MerchantReviewFilter;

type Props = {
  needsReplyCount?: number;
  filter: ReviewFilter;
  onFilterChange: (filter: ReviewFilter) => void;
  ordering: MerchantReviewOrdering;
  onOrderingChange: (ordering: MerchantReviewOrdering) => void;
};

const SORT_OPTIONS: { label: string; value: MerchantReviewOrdering }[] = [
  { label: "Newest", value: "newest" },
  { label: "Oldest", value: "oldest" },
];

const FILTERS: { label: string; value: ReviewFilter }[] = [
  {
    label: "All",
    value: "all",
  },
  {
    label: "Needs reply",
    value: "needs-reply",
  },
  {
    label: "Replied",
    value: "replied",
  },
];

/**
 * Introduces the explorer review feed and controls its reply-status filtering.
 *
 * Keeps feed-specific controls visually attached to the reviews they affect.
 */
export default function MerchantReviewFilters({
  needsReplyCount,
  filter,
  onFilterChange,
  ordering,
  onOrderingChange,
}: Props) {
  return (
    <View className="-mx-4 mt-6 border-t border-border-primary bg-surface px-4 pb-4 pt-6">
      {/* Review feed heading */}
      <View>
        <AppText weight="bold" className="text-lg text-text-primary">
          Reviews
        </AppText>

        <AppText className="mt-0.5 text-xs text-text-secondary">
          Feedback shared by explorers
        </AppText>
      </View>

      {/* Quick reply-status filtering and sorting match Reviews Collection. */}
      <View className="mt-4">
        <FilterSortControls
          activeFilterCount={filter === "all" ? 0 : 1}
          onClear={() => onFilterChange("all")}
          testID="merchant-review-quick-controls"
          backgroundColor={theme.extends.colors.surface}
        >
          {FILTERS.map((item) => (
            <FilterChip
              key={item.value}
              label={item.label}
              selected={filter === item.value}
              showSelectedCheck
              count={item.value === "needs-reply" ? needsReplyCount : undefined}
              onPress={() => onFilterChange(item.value)}
              accessibilityLabel={
                item.value === "needs-reply" &&
                needsReplyCount !== undefined &&
                needsReplyCount > 0
                  ? `${item.label}, ${needsReplyCount}`
                  : item.label
              }
            />
          ))}

          <View className="mx-1 h-6 w-px bg-border-primary" />

          {SORT_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              selected={ordering === option.value}
              showSelectedCheck
              onPress={() => onOrderingChange(option.value)}
              accessibilityLabel={`Sort by ${option.label}${
                ordering === option.value ? ", selected" : ""
              }`}
            />
          ))}
        </FilterSortControls>
      </View>
    </View>
  );
}
