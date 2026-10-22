import { useQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getExploreSpecialties } from "../api/exploreBusiness.service";
import {
  EXPLORE_SPECIALTIES_QUERY_KEY,
  EXPLORE_HOMEPAGE_RETENTION_MS,
} from "../constants/exploreHomepageQueries";

export { EXPLORE_SPECIALTIES_QUERY_KEY } from "../constants/exploreHomepageQueries";

/**
 * Loads the server-selected Specialty Tag shortcuts for Explorer discovery.
 *
 * The backend owns candidate selection and ordering so the mobile client
 * renders the discovery shortcuts exactly as returned.
 */
export default function useExploreSpecialties() {
  const query = useQuery({
    queryKey: EXPLORE_SPECIALTIES_QUERY_KEY,
    queryFn: async () => {
      const response = await getExploreSpecialties();

      return throwOnApiError(response);
    },
    gcTime: EXPLORE_HOMEPAGE_RETENTION_MS,
    staleTime: 5 * 60 * 1000,
  });

  return {
    specialties: query.data ?? [],
    isLoading: query.isLoading,
    isPaused: query.isPaused,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching && !query.isPaused,
    error: query.error,
    refetch: query.refetch,
  };
}
