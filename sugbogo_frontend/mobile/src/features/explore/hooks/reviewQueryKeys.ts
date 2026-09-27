import type { BusinessReviewFilters } from "../types/review.types";

export const businessReviewPreviewKey = (businessId: number) =>
  ["business-review-preview", businessId] as const;

export const businessReviewsKey = (businessId: number) =>
  ["business-reviews", businessId] as const;

export const filteredBusinessReviewsKey = (
  businessId: number,
  filters: BusinessReviewFilters,
) => {
  const baseKey = businessReviewsKey(businessId);

  if (
    !filters.sentiment &&
    !filters.topic &&
    !filters.hasPhotos &&
    !filters.merchantReplied &&
    filters.ordering === "newest"
  ) {
    return baseKey;
  }

  return [
    ...baseKey,
    {
      sentiment: filters.sentiment,
      topic: filters.topic,
      hasPhotos: filters.hasPhotos,
      merchantReplied: filters.merchantReplied,
      ordering: filters.ordering,
    },
  ] as const;
};

export const exploreBusinessDetailKey = (businessId: number) =>
  ["explore-business-detail", businessId] as const;
