import { useQuery } from "@tanstack/react-query";

import { getDiscoveryFeed } from "../api/exploreBusiness.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import {
  DISCOVERY_FEED_QUERY_KEY,
  EXPLORE_HOMEPAGE_RETENTION_MS,
} from "../constants/exploreHomepageQueries";

export { DISCOVERY_FEED_QUERY_KEY } from "../constants/exploreHomepageQueries";

/** Loads the first backend-ranked Discovery feed page with React Query. */
export default function useDiscoveryFeed() {
  const query = useQuery({
    queryKey: DISCOVERY_FEED_QUERY_KEY,
    queryFn: async () => {
      const response = await getDiscoveryFeed();

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
