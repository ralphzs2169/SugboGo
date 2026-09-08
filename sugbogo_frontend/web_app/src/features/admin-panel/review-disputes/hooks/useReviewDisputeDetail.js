import { useQuery } from "@tanstack/react-query";

import { fetchReviewDispute } from "../services/reviewDisputeService";

export default function useReviewDispute(disputeId, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: ["admin", "review-dispute", disputeId],
    queryFn: () => fetchReviewDispute(disputeId),
    enabled: enabled && Boolean(disputeId),
  });

  return {
    dispute: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
