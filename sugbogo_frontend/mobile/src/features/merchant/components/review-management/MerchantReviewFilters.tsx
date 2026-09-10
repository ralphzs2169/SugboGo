import { Pressable, View } from "react-native";
import AppText from "@/shared/components/AppText";

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
        <AppText weight="bold" className="text-lg  text-text-primary">
          Reviews
        </AppText>

        <AppText className="mt-0.5 text-xs text-text-secondary">
          Feedback shared by explorers
        </AppText>
      </View>

      {/* Reply-status filters */}
      <View className="mt-4 flex-row gap-2">
        {FILTERS.map((item) => {
          const isSelected = filter === item.value;
          const showCount = item.value === "needs-reply" && needsReplyCount > 0;

          return (
            <Pressable
              key={item.value}
              onPress={() => onFilterChange(item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              className={`min-h-11 cursor-pointer flex-row items-center justify-center rounded-full px-4 ${
                isSelected
                  ? "bg-brand"
                  : "border border-border-primary bg-surface"
              } active:opacity-80`}
            >
              <AppText
                className={`text-sm font-semibold ${
                  isSelected ? "text-white" : "text-text-secondary"
                }`}
              >
                {item.label}
              </AppText>

              {showCount && (
                <View
                  className={`ml-1.5 min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 ${
                    isSelected ? "bg-white/20" : "bg-brand/10"
                  }`}
                >
                  <AppText
                    className={`text-[10px] font-bold ${
                      isSelected ? "text-white" : "text-brand"
                    }`}
                  >
                    {needsReplyCount}
                  </AppText>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
