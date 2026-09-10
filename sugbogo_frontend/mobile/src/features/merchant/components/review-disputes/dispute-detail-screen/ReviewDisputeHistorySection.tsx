import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import { formatDate } from "@/shared/utils/date.utils";

import ReviewDisputeStatusBadge from "../ReviewDisputeStatusBadge";
import type { PreviousReviewDispute } from "../../../types/review-disputes/reviewDispute.types";

type Props = {
  currentAttemptNumber: number;
  previousDisputes: PreviousReviewDispute[];
  onViewAttempt: (disputeId: number) => void;
};

/**
 * Displays earlier dispute attempts as compact navigable history items.
 *
 * Each attempt surfaces its sequence, submission date, and final status while
 * allowing merchants to open the full historical dispute record.
 */
export default function ReviewDisputeHistorySection({
  currentAttemptNumber,
  previousDisputes,
  onViewAttempt,
}: Props) {
  if (previousDisputes.length === 0) {
    return (
      <View className="items-center rounded-xl  px-5 py-7">
        {/* Empty history state */}
        <View className="h-11 w-11 items-center justify-center rounded-full bg-surface-secondary">
          <MaterialCommunityIcons
            name="history"
            size={23}
            color={theme.extends.colors.text.tertiary}
          />
        </View>

        <AppText weight="semibold" className="mt-3 text-sm text-text-primary">
          No previous disputes
        </AppText>

        <AppText className="mt-1 text-center text-xs leading-5 text-text-secondary">
          This is the first dispute attempt for this review.
        </AppText>
      </View>
    );
  }

  return (
    <View className="gap-2.5">
      {/* Previous dispute attempts */}
      {previousDisputes.map((attempt, index) => {
        const attemptNumber = currentAttemptNumber - index - 1;

        return (
          <Pressable
            key={attempt.id}
            onPress={() => onViewAttempt(attempt.id)}
            accessibilityRole="button"
            accessibilityLabel={`View dispute attempt ${attemptNumber}`}
            className="cursor-pointer rounded-xl border border-border-primary  px-4 py-4 active:bg-surface-secondary"
          >
            <View className="flex-row items-center">
              {/* Attempt identity */}
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={20}
                  color={theme.extends.colors.text.secondary}
                />
              </View>

              <View className="min-w-0 flex-1">
                <AppText
                  weight="semibold"
                  className="text-sm text-text-primary"
                >
                  Dispute attempt {attemptNumber}
                </AppText>

                <View className="mt-1 flex-row items-center">
                  <MaterialCommunityIcons
                    name="calendar-blank-outline"
                    size={13}
                    color={theme.extends.colors.text.tertiary}
                  />

                  <AppText className="ml-1 text-xs text-text-secondary">
                    {formatDate(attempt.created_at)}
                  </AppText>
                </View>
              </View>

              {/* Attempt status and navigation */}
              <View className="ml-3 items-end">
                <ReviewDisputeStatusBadge status={attempt.status} />

                <MaterialCommunityIcons
                  name="chevron-right"
                  size={19}
                  color={theme.extends.colors.text.tertiary}
                  style={{ marginTop: 8 }}
                />
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
