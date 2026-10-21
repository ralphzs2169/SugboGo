import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import ReviewVibeBadge from "@/shared/components/reviews/ReviewVibeBadge";

import type { OverallReviewVibe } from "../../../types/exploreBusiness.types";

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
  return (
    <View>
      {/* Heading and overall vibe */}
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <AppText
          weight="bold"
          className={`min-w-0 flex-1 text-text-primary ${
            compact ? "text-sm" : "text-base"
          }`}
        >
          Recent Review Insights
        </AppText>

        <ReviewVibeBadge
          vibe={overallVibe}
          testID={
            compact ? "preview-overall-review-vibe" : "overall-review-vibe"
          }
        />
      </View>

      {/* Rolling-window context */}
      <AppText className="mt-1 text-xs leading-5 text-text-secondary">
        Based on {recentCount} eligible{" "}
        {recentCount === 1 ? "review" : "reviews"} from the past 30 days.
      </AppText>
    </View>
  );
}
