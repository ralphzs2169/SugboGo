import { useIsRestoring, useQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getRecommendations } from "../api/exploreBusiness.service";
import {
  RECOMMENDATIONS_QUERY_KEY,
  EXPLORE_BUSINESS_FEED_RETENTION_MS,
} from "../constants/exploreHomepageQueries";

export { RECOMMENDATIONS_QUERY_KEY } from "../constants/exploreHomepageQueries";

/** Loads the first server-ranked recommendation page without client sorting. */
export default function useRecommendations(enabled = true) {
  const isRestoring = useIsRestoring();
  const query = useQuery({
    enabled,
    queryKey: RECOMMENDATIONS_QUERY_KEY,
    queryFn: async () => {
      const response = await getRecommendations();

      return throwOnApiError(response);
    },
    gcTime: EXPLORE_BUSINESS_FEED_RETENTION_MS,
    staleTime: 5 * 60 * 1000,
  });

  return {
    businesses: query.data?.items ?? [],
    isPersonalized: query.data?.is_personalized,
    pagination: query.data?.pagination ?? null,
    isLoading:
      query.isLoading ||
      (
        enabled &&
        isRestoring &&
        query.isPending
      ),
    isPaused: query.isPaused,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching && !query.isPaused,
    error: query.error,
    refetch: query.refetch,
  };
}
