import { useQuery } from "@tanstack/react-query";

import { fetchUnderReviewReview } from "../services/underReviewService";

export default function useUnderReviewReview(reviewId) {
  const query = useQuery({
    queryKey: ["admin", "under-review", "detail", reviewId],
    queryFn: () => fetchUnderReviewReview(reviewId),
    enabled: Boolean(reviewId),
  });

  return {
    review: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
