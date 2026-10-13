import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchUnderReviewReviews } from "../services/underReviewService";

export default function useUnderReviewReviews(params) {
  const query = useQuery({
    queryKey: ["admin", "under-review", "list", params],
    queryFn: () => fetchUnderReviewReviews(params),
    placeholderData: keepPreviousData,
  });

  return {
    reviews: query.data?.items ?? [],
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
