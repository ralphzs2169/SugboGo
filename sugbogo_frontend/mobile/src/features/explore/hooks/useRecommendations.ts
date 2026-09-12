import { useQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getRecommendations } from "../api/exploreBusiness.service";

export const RECOMMENDATIONS_QUERY_KEY = ["explore-recommendations"] as const;

/** Loads the first server-ranked recommendation page without client sorting. */
export default function useRecommendations() {
  const query = useQuery({
    queryKey: RECOMMENDATIONS_QUERY_KEY,
    queryFn: async () => {
      const response = await getRecommendations();

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
