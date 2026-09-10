import { View } from "react-native";

import AppText from "@/shared/components/AppText";

import { REVIEW_DISPUTE_REASON_LABELS } from "../../../constants/reviewDispute.constants";
import type { ReviewDisputeReason } from "../../../types/review-disputes/reviewDispute.types";

type Props = {
  reason: ReviewDisputeReason;
  description: string;
};

/** Displays the merchant's selected dispute reason and written details. */
export default function ReviewDisputeDetailsSection({
  reason,
  description,
}: Props) {
  return (
    <View>
      <View>
        <AppText
          className="text-xs uppercase tracking-wide text-text-secondary"
          weight="semibold"
        >
          Reason
        </AppText>

        <AppText className="mt-1 text-sm text-text-primary" weight="medium">
          {REVIEW_DISPUTE_REASON_LABELS[reason]}
        </AppText>
      </View>

      <View className="mt-5">
        <AppText
          className="text-xs uppercase tracking-wide text-text-secondary"
          weight="semibold"
        >
          Details
        </AppText>

        <AppText className="mt-1 text-sm leading-6 text-text-primary">
          {description}
        </AppText>
      </View>
    </View>
  );
}
