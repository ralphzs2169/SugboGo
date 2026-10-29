import { useQuery } from "@tanstack/react-query";
import { analyticsQueryKeys } from "../queries/analyticsQueryKeys";
import { fetchAnalyticsTaxonomy } from "../services/taxonomyService";
import { ANALYTICS_STALE_TIME } from "../queries/analyticsQueryOptions";

/** Share option requests across independent scoped sections without coupling their report filters. */
export default function useAnalyticsTaxonomy() {
  const clusters = useQuery({ queryKey: analyticsQueryKeys.taxonomy("clusters"), queryFn: () => fetchAnalyticsTaxonomy("clusters"), staleTime: ANALYTICS_STALE_TIME });
  const categories = useQuery({ queryKey: analyticsQueryKeys.taxonomy("categories"), queryFn: () => fetchAnalyticsTaxonomy("categories"), staleTime: ANALYTICS_STALE_TIME });
  return { clusters, categories };
}
