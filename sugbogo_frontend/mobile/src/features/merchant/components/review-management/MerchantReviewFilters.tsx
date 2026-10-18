import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import FilterChip from "@/shared/components/FilterChip";
import SegmentedControl from "@/shared/components/SegmentedControl";
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

      {/* Reply-status filters */}
      <View className="mt-4 flex-row flex-wrap gap-2">
        {FILTERS.map((item) => (
          <FilterChip
            key={item.value}
            label={item.label}
            selected={filter === item.value}
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
      </View>
      {/* Small shared sorting control keeps the server's order visible and editable. */}
      <View className="mt-3 self-start">
        {/* Review ordering controls */}
        <View className="mt-4 gap-2">
          <AppText weight="semibold" className="text-sm text-text-secondary">
            Sort by
          </AppText>

          <View className="self-start">
            <SegmentedControl
              variant="sm"
              value={ordering}
              onChange={onOrderingChange}
              options={[
                {
                  value: "newest",
                  label: "Newest first",
                  accessibilityLabel: "Sort reviews by newest first",
                },
                {
                  value: "oldest",
                  label: "Oldest first",
                  accessibilityLabel: "Sort reviews by oldest first",
                },
              ]}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
