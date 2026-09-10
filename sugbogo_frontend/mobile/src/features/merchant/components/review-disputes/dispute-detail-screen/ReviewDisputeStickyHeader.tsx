import { Animated, View } from "react-native";

import AppText from "@/shared/components/AppText";

import { REVIEW_DISPUTE_REASON_LABELS } from "../../../constants/reviewDispute.constants";
import type {
  ReviewDisputeReason,
  ReviewDisputeStatus,
} from "../../../types/review-disputes/reviewDispute.types";
import ReviewDisputeStatusBadge from "../ReviewDisputeStatusBadge";

type Props = {
  attemptNumber: number;
  status: ReviewDisputeStatus;
  reason: ReviewDisputeReason;
  opacity: Animated.AnimatedInterpolation<number>;
};

/**
 * Displays compact dispute context once the primary overview scrolls away.
 *
 * The bar remains fixed beneath the existing page header so merchants can
 * retain the current dispute identity while reviewing lower page sections.
 */
export default function ReviewDisputeStickyHeader({
  attemptNumber,
  status,
  reason,
  opacity,
}: Props) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        opacity,
        zIndex: 50,
        elevation: 0,
      }}
      className="border-b border-border-primary bg-surface"
    >
      {/* Dispute context */}
      <View className="px-4 pb-3">
        <View className="flex-row items-center justify-between gap-3">
          <AppText
            weight="semibold"
            className="min-w-0 flex-1 text-sm text-text-primary"
            numberOfLines={1}
          >
            Dispute attempt {attemptNumber}
          </AppText>

          <ReviewDisputeStatusBadge status={status} />
        </View>

        <AppText className="mt-1 text-xs text-text-secondary" numberOfLines={1}>
          {REVIEW_DISPUTE_REASON_LABELS[reason]}
        </AppText>
      </View>
    </Animated.View>
  );
}
