import { useDiscoveryScoreAnalytics } from "../../analytics/hooks/useAnalyticsReports";

/** Reuse the shared score cache while exposing the controlled table's query states. */
export default function useDiscoveryScores(params) {
  const query = useDiscoveryScoreAnalytics(params);
  return {
    ...query,
    scores: query.data?.items ?? [],
    totalItems: query.data?.pagination?.total_items ?? 0,
    pageCount: query.data?.pagination?.total_pages ?? 0,
  };
}
