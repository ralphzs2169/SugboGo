import { useQuery } from "@tanstack/react-query";

import { getNewBusinesses } from "../api/exploreBusiness.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

export default function useNewBusinesses() {
  const query = useQuery({
    queryKey: ["explore-new-businesses"],
    queryFn: async () => {
      const response = await getNewBusinesses();

      return throwOnApiError(response);
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    businesses: query.data?.items ?? [],
    pagination: query.data?.pagination ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
  };
}
