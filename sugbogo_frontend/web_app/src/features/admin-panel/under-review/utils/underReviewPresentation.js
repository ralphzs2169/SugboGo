import { formatLabel } from "@/shared/utils/stringUtils";
import { formatRelativeDate } from "@/shared/utils/dateUtils";

export const HOLD_REASON_LABELS = {
  text_flagged: "Text flagged",
  image_flagged: "Image flagged",
  local_cebuano_safety: "Potential violent threat",
  provider_failure: "Automated moderation unavailable",
};

export function formatModerationQueueTime(value, now = Date.now()) {
  if (!value) {
    return "Unknown date";
  }

  const elapsedMinutes = Math.max(
    0,
    Math.floor((now - new Date(value).getTime()) / 60000),
  );

  if (elapsedMinutes < 1) {
    return "Just now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min ago`;
  }

  if (elapsedMinutes < 1440) {
    const hours = Math.floor(elapsedMinutes / 60);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }

  return formatRelativeDate(value);
}

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
