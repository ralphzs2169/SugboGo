import { useQuery } from "@tanstack/react-query";

import { getNewBusinesses } from "../api/exploreBusiness.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import {
  NEW_BUSINESSES_QUERY_KEY,
  EXPLORE_HOMEPAGE_RETENTION_MS,
} from "../constants/exploreHomepageQueries";

export { NEW_BUSINESSES_QUERY_KEY } from "../constants/exploreHomepageQueries";

export default function useNewBusinesses() {
  const query = useQuery({
    queryKey: NEW_BUSINESSES_QUERY_KEY,
    queryFn: async () => {
      const response = await getNewBusinesses();

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
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching && !query.isPaused,
  };
}
