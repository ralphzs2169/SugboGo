export const MY_REVIEWS_QUERY_KEY = ["my-reviews"] as const;

export const myReviewsKey = (userId: number | null) =>
  [...MY_REVIEWS_QUERY_KEY, userId] as const;
