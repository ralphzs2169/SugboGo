import { View, useWindowDimensions } from "react-native";

import AppText from "@/shared/components/AppText";
import MerchantMetricCard from "../MerchantMetricCard";
import { formatAnalyticsCount } from "../../utils/merchantAnalytics.utils";

type Props = {
  totalCount?: number;
  needsReplyCount?: number;
  filtered?: boolean;
  loading?: boolean;
};

/** Summarizes the current review feed using the shared Business Overview metric cards. */
export default function MerchantReviewsOverview({
  totalCount,
  needsReplyCount,
  filtered = false,
  loading = false,
}: Props) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 360 || fontScale >= 1.35;

  return (
    <View className="pt-5">
      {/* Review workload and filtered results remain distinct. */}
      <AppText
        weight="bold"
        accessibilityRole="header"
        className="text-base text-text-primary"
      >
        Review overview
      </AppText>
      <AppText className="mt-1 text-sm leading-5 text-text-secondary">
        Manage reviews and respond to feedback
      </AppText>
      <View className={stacked ? "mt-4 gap-3" : "mt-4 flex-row gap-3"}>
        <MerchantMetricCard
          icon="comment-text-outline"
          label={filtered ? "Matching reviews" : "Total reviews"}
          value={formatAnalyticsCount(totalCount ?? null)}
          unavailable={totalCount === undefined}
          detail={filtered ? "With your current filter" : "Across all reviews"}
          stacked={stacked}
          loading={loading}
        />
        <MerchantMetricCard
          icon="comment-check-outline"
          label="Needs reply"
          value={formatAnalyticsCount(needsReplyCount ?? null)}
          unavailable={needsReplyCount === undefined}
          detail="Across all reviews"
          stacked={stacked}
          loading={loading}
        />
      </View>
    </View>
  );
}
