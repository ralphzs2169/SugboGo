import { useQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getSimilarBusinesses } from "../api/exploreBusiness.service";

export const SIMILAR_BUSINESSES_QUERY_KEY = ["similar-businesses"] as const;

/** Loads the bounded taxonomy-similar places for one business profile. */
export default function useSimilarBusinesses(businessId: number) {
  const query = useQuery({
    queryKey: [...SIMILAR_BUSINESSES_QUERY_KEY, businessId],
    queryFn: async () => {
      const response = await getSimilarBusinesses(businessId);

      return throwOnApiError(response);
    },
    enabled: Boolean(businessId),
    staleTime: 5 * 60 * 1000,
  });

  return {
    businesses: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
