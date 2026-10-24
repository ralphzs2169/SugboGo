import type { ComponentProps } from "react";
import { ActivityIndicator, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import InfoBanner from "@/shared/components/InfoBanner";

import type { ReviewSubmissionDraft } from "../../../stores/reviewWorkflow.store";
import type { BusinessReview } from "../../../types/review.types";
import {
  isInlineReviewCheck,
  reviewModerationFeedback,
} from "../../../utils/reviewModeration.utils";
import PendingReviewStatus from "./PendingReviewStatus";

/** Presents author-only progress without changing submission or moderation decisions. */
export default function AuthorReviewStatus({
  review,
  submissionState,
  onCheckAgain,
  onResume,
}: {
  review?: Pick<BusinessReview, "status" | "moderation_progress"> | null;
  submissionState?: ReviewSubmissionDraft["state"];
  onCheckAgain?: () => void;
  onResume?: () => void;
}) {
  if (review) {
    if (review.status === "published") return null;
    if (isInlineReviewCheck(review)) {
      return (
        <PendingReviewStatus
          delayed={review.moderation_progress?.state === "awaiting_retry"}
        />
      );
    }
    const feedback = reviewModerationFeedback(review);
    return (
      <StatusBanner
        title={feedback.label}
        description={feedback.description}
        variant={feedback.label === "Under review" ? "info" : "warning"}
      />
    );
  }

  if (submissionState === "unconfirmed") {
    return (
      <StatusBanner
        title="Unable to confirm submission"
        description="We couldn’t confirm whether your review was received. Check again without submitting it again."
        variant="warning"
        actionTitle="Check again"
        onAction={onCheckAgain}
      />
    );
  }
  if (submissionState === "failed") {
    return (
      <StatusBanner
        title="Review wasn’t submitted"
        description="Your text and photos were kept so you can try again."
        variant="warning"
        actionTitle="Continue review"
        onAction={onResume}
      />
    );
  }
  if (!submissionState) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      className="mt-2 flex-row items-center gap-2"
    >
      {submissionState === "submitting" && (
        <ActivityIndicator
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Submitting review"
          size="small"
          color={theme.extends.colors.text.secondary}
        />
      )}
      <AppText className="flex-1 text-xs leading-5 text-text-secondary">
        {submissionState === "submitting"
          ? "Submitting…"
          : "Still confirming · You don’t need to submit again"}
      </AppText>
    </View>
  );
}

/** Reuses the existing banner and recovery action treatment within the card. */
function StatusBanner({
  description,
  ...props
}: Pick<
  ComponentProps<typeof InfoBanner>,
  "title" | "variant" | "actionTitle" | "onAction"
> & {
  description: string;
}) {
  return (
    <View accessibilityLiveRegion="polite" className="mt-3">
      <InfoBanner {...props}>
        <AppText className="text-xs leading-5 text-text-secondary">
          {description}
        </AppText>
      </InfoBanner>
    </View>
  );
}
