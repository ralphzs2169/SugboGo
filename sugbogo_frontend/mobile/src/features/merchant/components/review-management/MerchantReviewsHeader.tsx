import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import SafePressable from "@/shared/components/SafePressable";
import { theme } from "@/constants/theme";

type ReviewFilter = "all" | "needs-reply" | "replied";

type Props = {
  totalCount: number;
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
 * Displays the merchant review-page header, including review summary,
 * reply filters, and navigation to reusable reply templates.
 */
export default function MerchantReviewsHeader({
  totalCount,
  needsReplyCount,
  filter,
  onFilterChange,
}: Props) {
  return (
    <View className="pb-5 pt-4">
      {/* Review summary */}
      <Text className="text-2xl font-bold text-text-primary">Reviews</Text>

      <Text className="mt-1 text-sm text-text-secondary">
        {totalCount === 1
          ? "1 customer review"
          : `${totalCount} customer reviews`}
      </Text>

      {needsReplyCount > 0 && (
        <View className="mt-4 flex-row items-center rounded-card bg-brand/10 px-3 py-3">
          <MaterialCommunityIcons
            name="reply-outline"
            size={20}
            color={theme.extends.colors.brand}
          />

          <Text className="ml-2 flex-1 text-sm font-medium text-text-primary">
            {needsReplyCount === 1
              ? "1 review is waiting for your response."
              : `${needsReplyCount} reviews are waiting for your response.`}
          </Text>
        </View>
      )}

      {/* Review filters */}
      <View className="mt-4 flex-row gap-2">
        {FILTERS.map((item) => {
          const isSelected = filter === item.value;

          return (
            <Pressable
              key={item.value}
              onPress={() => onFilterChange(item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              className={`min-h-11 justify-center rounded-full px-4 ${
                isSelected
                  ? "bg-brand"
                  : "border border-border-primary bg-surface"
              } active:opacity-80`}
            >
              <Text
                className={`text-sm font-semibold ${
                  isSelected ? "text-white" : "text-text-secondary"
                }`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Reply templates navigation */}
      <SafePressable
        onPress={() => router.push("../reply-templates")}
        accessibilityRole="button"
        accessibilityLabel="Open reply templates"
        className="mt-4 flex-row items-center rounded-card border border-border-primary bg-surface px-4 py-4 active:opacity-80"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
          <MaterialCommunityIcons
            name="text-box-multiple-outline"
            size={21}
            color={theme.extends.colors.brand}
          />
        </View>

        <View className="ml-3 flex-1">
          <Text className="text-sm font-bold text-text-primary">
            Quick responses
          </Text>

          <Text className="mt-0.5 text-xs text-text-secondary">
            Save reusable responses for customer reviews.
          </Text>
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={22}
          color={theme.extends.colors.text.tertiary}
        />
      </SafePressable>
    </View>
  );
}
