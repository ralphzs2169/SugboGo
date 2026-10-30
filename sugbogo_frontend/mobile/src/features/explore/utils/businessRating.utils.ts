import type { BusinessSentimentRating } from "../types/businessRating.types";

/** Accept only a complete, current server value; never derive it from review totals. */
export function hasDisplayableBusinessRating(
  rating: BusinessSentimentRating | null | undefined,
): rating is BusinessSentimentRating & {
  value: number;
  contributing_review_count: number;
} {
  return Boolean(
    rating?.state === "ready" &&
    rating.value !== null &&
    Number.isFinite(rating.value) &&
    rating.value >= 1 &&
    rating.value <= 5 &&
    rating.contributing_review_count !== null &&
    Number.isInteger(rating.contributing_review_count) &&
    rating.contributing_review_count >= 5 &&
    rating.computed_at &&
    Number.isFinite(Date.parse(rating.computed_at)),
  );
}

/** Describe the same server value to screen readers on nested business-card buttons. */
export function businessRatingAccessibilityLabel(
  rating: BusinessSentimentRating | null | undefined,
) {
  if (!rating) return "";
  const disclosure = rating.experimental ? " Experimental." : "";
  if (hasDisplayableBusinessRating(rating)) {
    return `AI-derived sentiment rating ${rating.value.toFixed(1)} out of 5, based on ${rating.contributing_review_count} scored reviews.${disclosure}`;
  }
  const status =
    rating.state === "insufficient_data"
      ? rating.contributing_review_count === null
        ? "Not enough scored reviews. At least five required."
        : `Not enough scored reviews. ${rating.contributing_review_count} scored reviews; at least five required.`
      : rating.state === "pending"
        ? "Awaiting rating recalculation."
        : "Rating unavailable.";
  return `AI-derived sentiment rating. ${status}${disclosure}`;
}
