import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import FilterChip from "@/shared/components/FilterChip";

export type ReviewFilter = "all" | "needs-reply" | "replied";

type Props = {
  needsReplyCount: number;
  filter: ReviewFilter;
  onFilterChange: (filter: ReviewFilter) => void;
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
      <View className="mt-4 flex-row gap-2">
        {FILTERS.map((item) => (
          <FilterChip
            key={item.value}
            label={item.label}
            selected={filter === item.value}
            count={item.value === "needs-reply" ? needsReplyCount : undefined}
            onPress={() => onFilterChange(item.value)}
            accessibilityLabel={
              item.value === "needs-reply" && needsReplyCount > 0
                ? `${item.label}, ${needsReplyCount}`
                : item.label
            }
          />
        ))}
      </View>
    </View>
  );
}
