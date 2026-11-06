import { View } from "react-native";

import AppText from "@/shared/components/AppText";

type Props = {
  recentCount: number;
  reviewPopulation?: "eligible" | "classified";
  compact?: boolean;
};

/**
 * Displays the shared Review Insights heading and recent-review context.
 *
 * The compact variant preserves the smaller business-profile heading while the
 * default variant matches the full Reviews collection section hierarchy.
 */
export default function ReviewInsightsHeader({
  recentCount,
  reviewPopulation = "eligible",
  compact = false,
}: Props) {
  return (
    <View>
      {/* Heading */}
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <AppText
          weight="bold"
          className={`min-w-0 flex-1 text-text-primary ${
            compact ? "text-sm" : "text-base"
          }`}
        >
          Review Insights
        </AppText>
      </View>

      {/* Rolling-window context */}
      <AppText className="mt-1 text-xs leading-5 text-text-secondary">
        Based on {recentCount} {reviewPopulation}{" "}
        {recentCount === 1 ? "review" : "reviews"} from the past 30 days.
      </AppText>
    </View>
  );
}
