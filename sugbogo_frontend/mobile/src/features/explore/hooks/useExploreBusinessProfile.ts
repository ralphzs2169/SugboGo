import { useQuery } from "@tanstack/react-query";

import { getExploreBusinessDetail } from "../api/exploreBusiness.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

export default function useExploreBusinessProfile(businessId: number) {
  const query = useQuery({
    queryKey: ["explore-business-detail", businessId],
    queryFn: async () => {
      const response = await getExploreBusinessDetail(businessId);

      return throwOnApiError(response);
    },
    enabled: Boolean(businessId),
  });

  return {
    business: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
