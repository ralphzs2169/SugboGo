export const businessReviewPreviewKey = (businessId: number) =>
  ["business-review-preview", businessId] as const;

export const businessReviewsKey = (businessId: number) =>
  ["business-reviews", businessId] as const;

export const exploreBusinessDetailKey = (businessId: number) =>
  ["explore-business-detail", businessId] as const;
