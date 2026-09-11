import { useQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getExploreSpecialties } from "../api/exploreBusiness.service";

export const EXPLORE_SPECIALTIES_QUERY_KEY = ["explore-specialties"] as const;

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
    staleTime: 5 * 60 * 1000,
  });

  return {
    specialties: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}
