import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import InfoBanner from "@/shared/components/InfoBanner";

import {
  REVIEW_DISPUTE_CLOSURE_MESSAGES,
  REVIEW_DISPUTE_STATUS_LABELS,
} from "../../../constants/reviewDispute.constants";
import type { ReviewDisputeDetail } from "../../../types/review-disputes/reviewDispute.types";

type Props = {
  dispute: Pick<ReviewDisputeDetail, "status" | "review" | "material_content_changed">;
};

/** Shows review closure or accepted-content notices for a merchant dispute. */
export default function ReviewDisputeReviewNotice({ dispute }: Props) {
  const closureMessage = REVIEW_DISPUTE_CLOSURE_MESSAGES[dispute.status];
  const isUpdated = dispute.status === "pending"
    && Boolean(dispute.review)
    && dispute.material_content_changed === true;

  if (!closureMessage && !isUpdated) {
    return null;
  }

  return (
    <View className="px-4 py-3">
      {/* Existing informational notice */}
      <InfoBanner
        title={closureMessage ? REVIEW_DISPUTE_STATUS_LABELS[dispute.status] : "Review updated"}
        variant="info"
      >
        <AppText className="text-xs leading-5 text-text-secondary">
          {closureMessage ?? (
            "The reviewer has updated their review since you submitted this dispute. "
            + "Your dispute remains active, and the original content has been preserved for administrator review."
          )}
        </AppText>
      </InfoBanner>
    </View>
  );
}
