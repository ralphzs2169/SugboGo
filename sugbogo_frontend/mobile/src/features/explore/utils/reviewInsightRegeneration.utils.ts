import type {
  BusinessReviewInsights,
  ReviewInsightRegeneration,
} from "../types/exploreBusiness.types";

/** Prefer business-level progress, including when no summary has been created. */
export function resolveReviewInsightRegeneration(
  progress: ReviewInsightRegeneration | null | undefined,
  insights: BusinessReviewInsights | null | undefined,
) {
  return progress ?? insights?.regeneration ?? null;
}

/** Legacy rows have no successfully attributed coordinator revision. */
export function isTrackedReviewInsightRegeneration(
  progress: ReviewInsightRegeneration | null | undefined,
): progress is ReviewInsightRegeneration & {
  requested_revision: number;
  completed_revision: number;
} {
  return Boolean(
    progress &&
    progress.status !== "untracked" &&
    progress.requested_revision !== null &&
    progress.completed_revision !== null,
  );
}

/** Describe server-owned work without predicting when generation will finish. */
export function reviewInsightUpdateMessage(
  progress: ReviewInsightRegeneration | null | undefined,
) {
  if (!progress?.is_outstanding) return null;
  switch (progress.status) {
    case "scheduled":
      return "Review Insights will refresh shortly.";
    case "processing":
      return "Updating insights with the latest reviews.";
    case "retry_wait":
      return "Insights are taking longer to update.";
    default:
      return null;
  }
}
