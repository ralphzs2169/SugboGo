import { useQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getDiscoveryShortcuts } from "../api/exploreBusiness.service";
import {
  DISCOVERY_SHORTCUTS_QUERY_KEY,
  EXPLORE_HOMEPAGE_RETENTION_MS,
} from "../constants/exploreHomepageQueries";

export { DISCOVERY_SHORTCUTS_QUERY_KEY } from "../constants/exploreHomepageQueries";

export default function useDiscoveryShortcuts() {
  const query = useQuery({
    queryKey: DISCOVERY_SHORTCUTS_QUERY_KEY,
    queryFn: async () => {
      const response = await getDiscoveryShortcuts();

      return throwOnApiError(response);
    },
    gcTime: EXPLORE_HOMEPAGE_RETENTION_MS,
    staleTime: 5 * 60 * 1000,
  });

  return {
    shortcuts: query.data ?? [],
    isLoading: query.isLoading,
    isPaused: query.isPaused,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching && !query.isPaused,
  };
}
