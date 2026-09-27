import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import type { BusinessReviewInsights } from "../../../types/exploreBusiness.types";
import {
  OVERALL_REVIEW_VIBE_LABELS,
  OVERALL_REVIEW_VIBE_STYLES,
} from "../../../utils/reviewVibe.utils";

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
  const overallVibeStyle = overallVibe
    ? OVERALL_REVIEW_VIBE_STYLES[overallVibe]
    : null;

  return (
    <View className="rounded-xl bg-background px-4 py-3">
      {/* Summary heading, disclosure, and overall vibe */}
      <View className="flex-row items-start justify-between gap-3">
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

        {overallVibe && overallVibeStyle && (
          <View
            testID="summary-overall-review-vibe"
            className={`shrink-0 flex-row items-center rounded-full px-2.5 py-1.5 ${overallVibeStyle.containerClassName}`}
          >
            <View
              className={`mr-1.5 h-1.5 w-1.5 rounded-full ${overallVibeStyle.dotClassName}`}
            />

            <AppText
              weight="semibold"
              className={`text-[11px] ${overallVibeStyle.textClassName}`}
            >
              {OVERALL_REVIEW_VIBE_LABELS[overallVibe]}
            </AppText>
          </View>
        )}
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
