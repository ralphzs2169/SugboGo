import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";
import colors from "tailwindcss/colors";

import AppText from "@/shared/components/AppText";

import { REVIEW_DISPUTE_STATUS_LABELS } from "../../constants/reviewDispute.constants";
import type { ReviewDisputeStatus } from "../../types/review-disputes/reviewDispute.types";

type Props = {
  status: ReviewDisputeStatus;
};

const STATUS_STYLES: Record<
  ReviewDisputeStatus,
  {
    background: string;
    foreground: string;
    border: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
  }
> = {
  pending: {
    background: colors.blue[50],
    foreground: colors.blue[700],
    border: colors.blue[200],
    icon: "clock-outline",
  },
  upheld: {
    background: colors.emerald[50],
    foreground: colors.emerald[700],
    border: colors.emerald[200],
    icon: "check-circle-outline",
  },
  dismissed: {
    background: colors.red[50],
    foreground: colors.red[700],
    border: colors.red[200],
    icon: "close-circle-outline",
  },
  withdrawn: {
    background: colors.gray[100],
    foreground: colors.gray[700],
    border: colors.gray[300],
    icon: "undo-variant",
  },
};

/**
 * Displays a dispute status badge using soft status colors, icons, and text.
 *
 * Each moderation state remains visually distinct while keeping foreground
 * content consistently readable against the status background.
 */
export default function ReviewDisputeStatusBadge({ status }: Props) {
  const style = STATUS_STYLES[status];

  return (
    <View
      className="self-start flex-row items-center rounded-full px-3 py-1.5"
      style={{
        backgroundColor: style.background,
        borderColor: style.border,
        borderWidth: 1,
      }}
      accessibilityLabel={`Dispute status: ${REVIEW_DISPUTE_STATUS_LABELS[status]}`}
    >
      <MaterialCommunityIcons name={style.icon} size={15} color={style.foreground} />

      <AppText
        weight="bold"
        className="ml-1.5 text-xs"
        style={{ color: style.foreground }}
      >
        {REVIEW_DISPUTE_STATUS_LABELS[status]}
      </AppText>
    </View>
  );
}
