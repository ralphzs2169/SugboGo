import { useQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getRecommendations } from "../api/exploreBusiness.service";
import {
  RECOMMENDATIONS_QUERY_KEY,
  EXPLORE_HOMEPAGE_RETENTION_MS,
} from "../constants/exploreHomepageQueries";

export { RECOMMENDATIONS_QUERY_KEY } from "../constants/exploreHomepageQueries";

/** Loads the first server-ranked recommendation page without client sorting. */
export default function useRecommendations() {
  const query = useQuery({
    queryKey: RECOMMENDATIONS_QUERY_KEY,
    queryFn: async () => {
      const response = await getRecommendations();

      return throwOnApiError(response);
    },
    gcTime: EXPLORE_HOMEPAGE_RETENTION_MS,
    staleTime: 5 * 60 * 1000,
  });

  return {
    businesses: query.data?.items ?? [],
    pagination: query.data?.pagination ?? null,
    isLoading: query.isLoading,
    isPaused: query.isPaused,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching && !query.isPaused,
    error: query.error,
    refetch: query.refetch,
  };
}
