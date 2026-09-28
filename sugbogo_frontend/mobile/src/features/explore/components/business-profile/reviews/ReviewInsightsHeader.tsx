import { View } from "react-native";

import AppText from "@/shared/components/AppText";

import type { OverallReviewVibe } from "../../../types/exploreBusiness.types";
import {
  OVERALL_REVIEW_VIBE_LABELS,
  OVERALL_REVIEW_VIBE_STYLES,
} from "../../../utils/reviewVibe.utils";

type Props = {
  recentCount: number;
  overallVibe?: OverallReviewVibe | null;
  compact?: boolean;
};

/**
 * Displays the shared Review Insights heading, recent-review context, and vibe.
 *
 * The compact variant preserves the smaller business-profile heading while the
 * default variant matches the full Reviews collection section hierarchy.
 */
export default function ReviewInsightsHeader({
  recentCount,
  overallVibe = null,
  compact = false,
}: Props) {
  const overallVibeStyle = overallVibe
    ? OVERALL_REVIEW_VIBE_STYLES[overallVibe]
    : null;

  return (
    <View>
      {/* Heading and overall vibe */}
      <View className="flex-row items-center justify-between gap-3">
        <AppText
          weight="bold"
          className={`min-w-0 flex-1 text-text-primary ${
            compact ? "text-sm" : "text-base"
          }`}
        >
          Recent Review Insights
        </AppText>

        {overallVibe && overallVibeStyle && (
          <View
            testID={
              compact ? "preview-overall-review-vibe" : "overall-review-vibe"
            }
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

      {/* Rolling-window context */}
      <AppText className="mt-1 text-xs leading-5 text-text-secondary">
        Based on {recentCount} eligible{" "}
        {recentCount === 1 ? "review" : "reviews"} from the past 30 days.
      </AppText>
    </View>
  );
}
