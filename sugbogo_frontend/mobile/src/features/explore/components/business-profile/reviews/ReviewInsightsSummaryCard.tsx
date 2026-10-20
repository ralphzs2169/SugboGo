import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ReviewVibeBadge from "@/shared/components/reviews/ReviewVibeBadge";

import type { BusinessReviewInsights } from "../../../types/exploreBusiness.types";

type OverallVibe = NonNullable<BusinessReviewInsights["overall_vibe"]>;

type Props = {
  narrative: string;
  overallVibe?: OverallVibe | null;
  footer?: ReactNode;
};

/**
 * Displays the generated Review Insights narrative with its AI disclosure.
 *
 * Optionally presents the overall review vibe and supporting footer content.
 */
export default function ReviewInsightsSummaryCard({
  narrative,
  overallVibe,
  footer,
}: Props) {
  return (
    <View className="rounded-xl bg-background px-4 py-3">
      {/* Summary heading, disclosure, and overall vibe */}
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
          <AppText weight="semibold" className="text-sm text-text-primary">
            Summary
          </AppText>

          <View className="flex-row items-center gap-1">
            <MaterialCommunityIcons
              name="creation"
              size={12}
              color={theme.extends.colors.text.tertiary}
            />

            <AppText className="text-[10px] text-text-tertiary">
              AI-generated
            </AppText>
          </View>
        </View>

        <ReviewVibeBadge
          vibe={overallVibe}
          testID="summary-overall-review-vibe"
        />
      </View>

      {/* Generated narrative */}
      <AppText className="mt-3 text-sm leading-5 text-text-primary">
        {narrative}
      </AppText>

      {/* Supporting context */}
      {footer && <View className="mt-3">{footer}</View>}
    </View>
  );
}
