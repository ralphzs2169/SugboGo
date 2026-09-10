import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";

import { REVIEW_DISPUTE_STATUS_LABELS } from "../../constants/reviewDispute.constants";
import type { ReviewDisputeStatus } from "../../types/review-disputes/reviewDispute.types";

type Props = {
  status: ReviewDisputeStatus;
};

const STATUS_STYLES: Record<
  ReviewDisputeStatus,
  {
    container: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  }
> = {
  pending: {
    container: "bg-blue-500",
    icon: "clock-outline",
  },
  upheld: {
    container: "bg-emerald-500",
    icon: "check-circle-outline",
  },
  dismissed: {
    container: "bg-red-500",
    icon: "close-circle-outline",
  },
  withdrawn: {
    container: "bg-gray-500",
    icon: "undo-variant",
  },
};

/**
 * Displays a dispute status badge using solid status colors, icons, and text.
 *
 * Each moderation state remains visually distinct while keeping foreground
 * content consistently readable against the status background.
 */
export default function ReviewDisputeStatusBadge({ status }: Props) {
  const style = STATUS_STYLES[status];

  return (
    <View
      className={`self-start flex-row items-center rounded-full px-3 py-1.5 ${style.container}`}
      accessibilityLabel={`Dispute status: ${REVIEW_DISPUTE_STATUS_LABELS[status]}`}
    >
      <MaterialCommunityIcons name={style.icon} size={15} color="#FFFFFF" />

      <AppText weight="bold" className="ml-1.5 text-xs text-white">
        {REVIEW_DISPUTE_STATUS_LABELS[status]}
      </AppText>
    </View>
  );
}
