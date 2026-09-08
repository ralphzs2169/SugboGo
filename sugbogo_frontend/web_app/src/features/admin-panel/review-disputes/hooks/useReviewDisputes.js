import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchReviewDisputes } from "../services/reviewDisputeService";

export default function useReviewDisputes(
  params = {},
  { enabled = true } = {},
) {
  const query = useQuery({
    queryKey: ["admin", "review-disputes", params],
    queryFn: () => fetchReviewDisputes(params),
    enabled,
    placeholderData: keepPreviousData,
  });

  const response = query.data;

  return {
    disputes: response?.items ?? [],
    totalItems: response?.pagination?.total_items ?? 0,
    pageCount: response?.pagination?.total_pages ?? 0,

    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,

    refetch: query.refetch,
  };
}
