import {
  fetchAllReview,
  fetchAllReviews,
  fetchAllReviewSummary,
} from "../services/allReviewService";

export const allReviewKeys = {
  summary: ["admin", "all-reviews", "summary"],
  list: (params) => ["admin", "all-reviews", "list", params],
  detail: (reviewId) => ["admin", "all-reviews", "detail", reviewId],
};

/** Share a cancellable summary request and refresh when returning from Moderation. */
export function allReviewSummaryOptions() {
  return {
    queryKey: allReviewKeys.summary,
    queryFn: ({ signal }) => fetchAllReviewSummary({ signal }),
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  };
}

/** Keep pages in separate caches without displaying a previous page's rows. */
export function allReviewListOptions(params) {
  return {
    queryKey: allReviewKeys.list(params),
    queryFn: ({ signal }) => fetchAllReviews(params, { signal }),
    staleTime: 0,
    refetchOnWindowFocus: true,
  };
}

/** Isolate selected-review data and revalidate cached details whenever reopened. */
export function allReviewDetailOptions(reviewId) {
  return {
    queryKey: allReviewKeys.detail(reviewId),
    queryFn: ({ signal }) => fetchAllReview(reviewId, { signal }),
    enabled: Number.isSafeInteger(reviewId) && reviewId > 0,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  };
}
