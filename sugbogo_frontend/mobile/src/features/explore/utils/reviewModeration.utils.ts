import type { BusinessReview } from "../types/review.types";

type ModeratedReview = Pick<BusinessReview, "status" | "moderation_progress">;

/** Keep queued, active and delayed automatic checks within the review card. */
export function isInlineReviewCheck(review: ModeratedReview) {
  return (
    review.status === "under_review" &&
    (review.moderation_progress?.state === "pending" ||
      review.moderation_progress?.state === "processing" ||
      review.moderation_progress?.state === "awaiting_retry")
  );
}

/** Present private moderation progress without exposing internal findings. */
export function reviewModerationFeedback(review: ModeratedReview) {
  if (review.status === "published")
    return {
      label: "Published",
      description: "Your review is publicly available.",
    };
  if (review.status === "rejected")
    return {
      label: "Not published",
      description: "Your review wasn’t published and is visible only to you.",
    };
  if (!review.moderation_progress && review.status === "flagged")
    return {
      label: "Not published",
      description: "Your review wasn’t published and is visible only to you.",
    };

  switch (review.moderation_progress?.state) {
    case "pending":
    case "processing":
      return {
        label: "Checking",
        description: "We're checking your review before it appears publicly.",
      };
    case "awaiting_retry":
      return {
        label: "Delayed",
        description:
          "Checking is taking longer. Your review is saved and we'll try again.",
      };
    case "awaiting_admin_review":
      return {
        label: "Under review",
        description:
          "Your review is awaiting a team review before it can appear publicly.",
      };
    case "retries_exhausted":
      return {
        label: "Needs review",
        description:
          "Automatic checking couldn’t finish. Your review remains private while it waits for team review.",
      };
    default:
      return {
        label: "Under review",
        description:
          "Your review is saved privately. Its status is not yet confirmed.",
      };
  }
}

/** Held reviews remain private while either automatic or team checks are pending. */
export function isHeldReview(review: Pick<BusinessReview, "status">) {
  return review.status === "under_review" || review.status === "flagged";
}
