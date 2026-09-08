import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { theme } from "@/constants/theme";

import { REVIEW_DISPUTE_STATUS_LABELS } from "../../constants/reviewDispute.constants";
import type { ReviewDisputeStatus } from "../../types/review-disputes/reviewDispute.types";

type Props = {
  status: ReviewDisputeStatus;
};

const STATUS_STYLES: Record<
  ReviewDisputeStatus,
  {
    container: string;
    text: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    iconColor: string;
  }
> = {
  pending: {
    container: "bg-brand/10",
    text: "text-brand",
    icon: "clock-outline",
    iconColor: theme.extends.colors.brand,
  },
  upheld: {
    container: "bg-red-50",
    text: "text-text-error",
    icon: "close-circle-outline",
    iconColor: theme.extends.colors.error,
  },
  dismissed: {
    container: "bg-green-50",
    text: "text-green-700",
    icon: "check-circle-outline",
    iconColor: theme.extends.colors.success,
  },
  withdrawn: {
    container: "bg-surface-secondary",
    text: "text-text-secondary",
    icon: "undo-variant",
    iconColor: theme.extends.colors.text.secondary,
  },
};

/** Displays a text-and-icon dispute status without relying on color alone. */
export default function ReviewDisputeStatusBadge({ status }: Props) {
  const style = STATUS_STYLES[status];

  return (
    <View
      className={`self-start flex-row items-center rounded-full px-3 py-1.5 ${style.container}`}
      accessibilityLabel={`Dispute status: ${REVIEW_DISPUTE_STATUS_LABELS[status]}`}
    >
      <MaterialCommunityIcons
        name={style.icon}
        size={15}
        color={style.iconColor}
      />

      <Text className={`ml-1.5 text-xs font-bold ${style.text}`}>
        {REVIEW_DISPUTE_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}
