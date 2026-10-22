import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { getExploreBusinessDetail } from "../api/exploreBusiness.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { exploreBusinessDetailKey } from "./reviewQueryKeys";
import { recentBusinessDetails } from "../services/recentBusinessDetails.service";
import { isBusinessDetailDenied } from "../utils/businessDetailAvailability";

export default function useExploreBusinessProfile(businessId: number) {
  const client = useQueryClient();
  const [successfulFetch, setSuccessfulFetch] = useState<{
    businessId: number;
    generation: number;
    ownerId: number;
    apiScope: string;
  } | null>(null);
  const query = useQuery({
    queryKey: exploreBusinessDetailKey(businessId),
    queryFn: async () => {
      const session = recentBusinessDetails.capture();
      try {
        const response = await getExploreBusinessDetail(businessId);
        const business = throwOnApiError(response);
        if (session.isCurrent() && business.id === businessId) {
          void session.save(business, Date.now());
          setSuccessfulFetch({
            businessId,
            generation: session.generation,
            ownerId: session.ownerId!,
            apiScope: session.apiScope,
          });
        }
        return business;
      } catch (error) {
        if (session.isAuthorized() && isBusinessDetailDenied(error)) {
          void session.remove(businessId);
          // A later transport error must not revive the previously denied DTO.
          client.setQueryData(exploreBusinessDetailKey(businessId), null);
        }
        throw error;
      }
    },
    enabled: Boolean(businessId),
    retry: (failureCount, error) =>
      !isBusinessDetailDenied(error) && failureCount < 1,
  });

  return {
    business: query.data ?? null,
    successfulFetch,
    isLoading: query.isLoading,
    error: query.error,
    isPaused: query.isPaused,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
