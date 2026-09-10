import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { formatDate } from "@/shared/utils/date.utils";

import { REVIEW_DISPUTE_REASON_LABELS } from "../../../constants/reviewDispute.constants";
import ReviewDisputeStatusBadge from "../ReviewDisputeStatusBadge";
import type {
  ReviewDisputeReason,
  ReviewDisputeStatus,
} from "../../../types/review-disputes/reviewDispute.types";

type Props = {
  attemptNumber: number;
  createdAt: string;
  resolvedAt: string | null;
  status: ReviewDisputeStatus;
  reason: ReviewDisputeReason;
};

/**
 * Presents the primary overview of a review dispute.
 *
 * Highlights the dispute attempt, moderation status, reason, and important
 * dates so merchants can quickly understand the case before viewing details.
 */
export default function ReviewDisputeOverviewSection({
  attemptNumber,
  createdAt,
  resolvedAt,
  status,
  reason,
}: Props) {
  return (
    <View className="px-4 py-2 bg-surface">
      {/* Dispute identity and status */}
      <View className="flex-row items-start justify-between gap-4">
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center">
            <View className="min-w-0 flex-1">
              <AppText weight="bold" className="text-lg text-text-primary">
                Dispute attempt {attemptNumber}
              </AppText>

              <AppText className="mt-0.5 text-xs text-text-secondary">
                Review dispute
              </AppText>
            </View>
          </View>
        </View>

        <ReviewDisputeStatusBadge status={status} />
      </View>

      {/* Dispute reason */}
      <View className="mt-5 rounded-xl bg-background px-4 py-3.5">
        <View className="flex-row items-center">
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={17}
            color={theme.extends.colors.text.secondary}
          />

          <AppText
            weight="semibold"
            className="ml-2 text-xs uppercase tracking-wide text-text-secondary"
          >
            Reason
          </AppText>
        </View>

        <AppText
          weight="semibold"
          className="mt-2 text-sm leading-5 text-text-primary"
        >
          {REVIEW_DISPUTE_REASON_LABELS[reason]}
        </AppText>
      </View>

      {/* Dispute timeline */}
      <View className="mt-5">
        {/* Submitted */}
        <View className="flex-row">
          <View className="items-center">
            <View className="h-3 w-3 rounded-full bg-brand" />

            <View className="my-1 h-8 w-px bg-border-primary" />
          </View>

          <View className="ml-3 pb-2">
            <AppText weight="semibold" className="text-sm text-text-primary">
              Submitted
            </AppText>

            <AppText className="mt-0.5 text-xs text-text-secondary">
              {formatDate(createdAt)}
            </AppText>
          </View>
        </View>

        {/* Current outcome */}
        <View className="flex-row">
          <View className="items-center">
            <View
              className={`h-3 w-3 rounded-full ${
                resolvedAt ? "bg-success" : "border-2 border-brand bg-surface"
              }`}
            />
          </View>

          <View className="ml-3">
            <AppText weight="semibold" className="text-sm text-text-primary">
              {resolvedAt
                ? status === "upheld"
                  ? "Upheld"
                  : status === "dismissed"
                    ? "Dismissed"
                    : "Withdrawn"
                : "Pending"}
            </AppText>

            {resolvedAt && (
              <AppText className="mt-0.5 text-xs text-text-secondary">
                {formatDate(resolvedAt)}
              </AppText>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
