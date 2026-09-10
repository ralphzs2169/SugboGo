import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import AppText from "@/shared/components/AppText";

import { theme } from "@/constants/theme";

type Props = {
  totalCount?: number;
  needsReplyCount?: number;
};

/**
 * Presents the merchant reviews page identity and high-level review summary.
 *
 * Review counts gracefully show as unavailable when review data cannot be
 * loaded, while the page-level navigation affordances remain visible.
 */
export default function MerchantReviewsOverview({
  totalCount,
  needsReplyCount,
}: Props) {
  const totalReviewLabel =
    totalCount === undefined
      ? "Total reviews"
      : totalCount === 1
        ? "Total review"
        : "Total reviews";

  return (
    <View className="pt-4">
      {/* Page identity and actions */}
      <View className="flex-row items-start justify-between">
        <View className="min-w-0 flex-1 pr-4">
          <AppText
            weight="bold"
            className="text-2xl tracking-tight text-text-primary"
          >
            Reviews & Feedback
          </AppText>

          <AppText className="mt-1 text-sm text-text-secondary">
            Manage reviews and respond to feedback
          </AppText>
        </View>

        <View className="flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search reviews"
            className="h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border-primary bg-surface active:opacity-70"
          >
            <MaterialCommunityIcons
              name="magnify"
              size={21}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review notifications"
            className="h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border-primary bg-surface active:opacity-70"
          >
            <MaterialCommunityIcons
              name="bell-outline"
              size={20}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>
        </View>
      </View>

      {/* Review summary */}
      <View className="mt-5 flex-row rounded-card border border-border-primary bg-surface px-4 py-4">
        <View className="flex-1">
          <AppText className="text-xl font-bold text-text-primary">
            {totalCount ?? "—"}
          </AppText>

          <AppText className="mt-0.5 text-xs text-text-secondary">
            {totalReviewLabel}
          </AppText>
        </View>

        <View className="mx-4 w-px bg-border-primary" />

        <View className="flex-1">
          <AppText className="text-xl font-bold text-text-primary">
            {needsReplyCount ?? "—"}
          </AppText>

          <AppText className="mt-0.5 text-xs text-text-secondary">
            Needs reply
          </AppText>
        </View>
      </View>
    </View>
  );
}
