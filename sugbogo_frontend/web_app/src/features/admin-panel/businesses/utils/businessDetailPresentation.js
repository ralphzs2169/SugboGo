const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Format authoritative timestamps in Philippine time without inventing a missing date. */
export function formatBusinessDateTime(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Unavailable";
  return dateFormatter.format(new Date(value));
}

/** Validate the authoritative rating for display without deriving it from review totals. */
export function hasReadyBusinessRating(rating) {
  return Boolean(
    rating?.state === "ready" &&
    Number.isFinite(rating.value) &&
    rating.value >= 1 &&
    rating.value <= 5 &&
    Number.isInteger(rating.contributing_review_count) &&
    rating.contributing_review_count >= 5 &&
    rating.computed_at &&
    Number.isFinite(Date.parse(rating.computed_at)),
  );
}

/** Observe explicit outstanding work; an outdated retained bundle is not itself a worker. */
export function hasPendingBusinessInsights(business) {
  return Boolean(
    business?.review_insight_regeneration?.is_outstanding ||
    business?.review_insights?.state === "pending" ||
    (business?.sentiment_rating_enabled &&
      business?.sentiment_rating?.automatic_updates_enabled &&
      business?.sentiment_rating?.state === "pending"),
  );
}
