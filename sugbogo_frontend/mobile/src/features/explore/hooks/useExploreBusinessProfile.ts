import { businessAvailability } from "@/features/business-availability/services/businessAvailability.service";
import useBusinessAvailability from "@/features/business-availability/hooks/useBusinessAvailability";
import { useCallback , useState } from "react";
import { useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getExploreBusinessDetail } from "../api/exploreBusiness.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { exploreBusinessDetailKey } from "./reviewQueryKeys";
import { exploreBusinessDetailStaleTime } from "./exploreBusinessDetailQueryPolicy";
import { recentBusinessDetails } from "../services/recentBusinessDetails.service";
import { isBusinessDetailDenied } from "../utils/businessDetailAvailability";

export default function useExploreBusinessProfile(businessId: number) {
  const client = useQueryClient();
  const availability = useBusinessAvailability([businessId], { check: false });
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
      const observation = businessAvailability.begin();
      try {
        const response = await getExploreBusinessDetail(businessId);
        const business = throwOnApiError(response);
        if (session.isCurrent() && business.id === businessId) {
          void session.save(business, Date.now());
          void businessAvailability
            .confirm(
              observation,
              [{ businessId, state: "available" }],
              new Date().toISOString(),
            )
            .catch(() => undefined);
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
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "NOT_FOUND"
          ) {
            void businessAvailability
              .confirm(
                observation,
                [{ businessId, state: "unavailable" }],
                new Date().toISOString(),
              )
              .catch(() => undefined);
          } else {
            void session.remove(businessId);
          }
          // A later transport error must not revive the previously denied DTO.
          client.setQueryData(exploreBusinessDetailKey(businessId), null);
        }
        throw error;
      }
    },
    enabled: Boolean(businessId),
    staleTime: (query) => exploreBusinessDetailStaleTime(query.state.data),
    // Offline source recovery requires a new authoritative response receipt.
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
    retry: (failureCount, error) =>
      !isBusinessDetailDenied(error) && failureCount < 1,
  });

  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      if (businessId) void refetch({ cancelRefetch: false });
    }, [businessId, refetch]),
  );
  return {
    business:
      availability.get(businessId)?.state === "unavailable"
        ? null
        : (query.data ?? null),
    successfulFetch,
    availability,
    isLoading: query.isLoading,
    error: query.error,
    isPaused: query.isPaused,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
