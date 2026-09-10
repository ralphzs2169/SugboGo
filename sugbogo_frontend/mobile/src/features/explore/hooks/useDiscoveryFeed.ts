import { useQuery } from "@tanstack/react-query";

import { getDiscoveryFeed } from "../api/exploreBusiness.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

export const DISCOVERY_FEED_QUERY_KEY = ["explore-discovery"] as const;

/** Loads the first backend-ranked Discovery feed page with React Query. */
export default function useDiscoveryFeed() {
  const query = useQuery({
    queryKey: DISCOVERY_FEED_QUERY_KEY,
    queryFn: async () => {
      const response = await getDiscoveryFeed();

      return throwOnApiError(response);
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    businesses: query.data?.items ?? [],
    pagination: query.data?.pagination ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}
