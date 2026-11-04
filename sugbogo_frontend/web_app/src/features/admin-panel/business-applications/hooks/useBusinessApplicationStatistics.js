import { useQuery } from "@tanstack/react-query";
import { fetchBusinessApplicationStatistics } from "../services/businessApplicationService";
import { adminApplicationKeys } from "../queries/applicationQueryKeys";

const emptyStatistics = {
  pending_review: null,
  approaching_sla: null,
  overdue: null,
  oldest_pending_business_days: null,
  approved: null,
  rejected: null,
  total_applications: null,
  review_sla_business_days: 0,
  review_sla_approaching_business_days: 0,
};

/** Normalize missing measurements without converting measured zeroes to unavailable. */
function selectStatistics(response) {
  return Object.fromEntries(
    Object.entries(emptyStatistics).map(([key, fallback]) => [
      key, response[key] ?? fallback,
    ]),
  );
}

/** Loads current review queue metrics and status totals for application management. */
export default function useBusinessApplicationStatistics({ enabled = true } = {}) {
  const query = useQuery({
    queryKey: adminApplicationKeys.statistics,
    queryFn: fetchBusinessApplicationStatistics,
    enabled,
    select: selectStatistics,
  });

  return {
    statistics: query.data ?? emptyStatistics,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
