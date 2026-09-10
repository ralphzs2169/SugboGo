import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ReviewContent from "@/features/explore/components/business-profile/review-section/ReviewContent";

import { REVIEW_DISPUTE_REASON_LABELS } from "../../../constants/reviewDispute.constants";
import type {
  DisputedReview,
  ReviewDisputeReason,
} from "../../../types/review-disputes/reviewDispute.types";

type Props = {
  review: DisputedReview;
  reason: ReviewDisputeReason;
  description: string;
};

/**
 * Displays the disputed review together with the merchant's reason and
 * submitted explanation while keeping review interactions hidden.
 */
export default function ReviewDisputedReviewSection({
  review,
  reason,
  description,
}: Props) {
  return (
    <View>
      {/* Disputed review */}
      <View className="overflow-hidden px-4 py-4 rounded-xl border border-border-primary">
        <ReviewContent
          review={review}
          perspective="merchant"
          showEngagement={false}
          showSpecialtyVouches={false}
        />
      </View>

      {/* Dispute context */}
      <View className="my-5 flex-row items-center">
        <View className="h-px flex-1 bg-border-primary" />

        <AppText
          weight="semibold"
          className="mx-3 text-[10px] uppercase tracking-wider text-text-tertiary"
        >
          Disputed because
        </AppText>

        <View className="h-px flex-1 bg-border-primary" />
      </View>

      {/* Dispute reason */}
      <View className="self-start rounded-full bg-red-50 px-3 py-1.5">
        <AppText weight="semibold" className="text-xs text-text-error">
          {REVIEW_DISPUTE_REASON_LABELS[reason]}
        </AppText>
      </View>

      {/* Merchant explanation */}
      <View className="mt-4">
        <AppText
          weight="semibold"
          className="text-xs uppercase tracking-wide text-text-secondary"
        >
          Your explanation
        </AppText>

        <View className="mt-2 overflow-hidden rounded-xl bg-background">
          <View className="flex-row">
            {/* Statement accent */}
            <View className="w-1 bg-brand" />

            <View className="flex-1 px-4 py-4">
              <MaterialCommunityIcons
                name="format-quote-open"
                size={20}
                color={theme.extends.colors.text.tertiary}
              />

              <AppText className="mt-1 text-sm leading-6 text-text-primary">
                {description}
              </AppText>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
