import { formatLabel } from "@/shared/utils/stringUtils";

export const HOLD_REASON_LABELS = {
  text_flagged: "Text flagged",
  image_flagged: "Image flagged",
  provider_failure: "Automated moderation unavailable",
};

export function formatModerationCategory(category) {
  return formatLabel(category?.replaceAll("/", " "), "Unknown category");
}

export function nextReviewId(reviews, resolvedId) {
  const index = reviews.findIndex((review) => review.id === resolvedId);
  if (index < 0) {
    return null;
  }
  return reviews[index + 1]?.id ?? reviews[index - 1]?.id ?? null;
}
