import { useMutation } from "@tanstack/react-query";

import {
  recordBusinessImpressions,
  recordBusinessProfileVisit,
} from "../api/exploreBusiness.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import type { DiscoverySource } from "../constants/discoverySources";

function retryVisibility(failureCount: number, error: unknown) {
  const code = (error as { code?: string })?.code;

  return (
    failureCount < 1 &&
    (code === "NETWORK_ERROR" ||
      code === "REQUEST_TIMEOUT" ||
      code === "VISIBILITY_TRACKING_UNAVAILABLE")
  );
}

// Background writes deliberately have no cache or user-facing error handlers.
// Always attempt/settle offline too: these events must not become a paused queue.
export function useRecordBusinessImpressions() {
  return useMutation({
    mutationFn: async (businessIds: number[]) => {
      const response = await recordBusinessImpressions(businessIds);
      return throwOnApiError(response);
    },
    retry: retryVisibility,
    retryDelay: 1000,
    networkMode: "always",
    throwOnError: false,
  });
}

export function useRecordBusinessProfileVisit() {
  return useMutation({
    mutationFn: async (
      visit: number | { businessId: number; discoverySource: DiscoverySource },
    ) => {
      // Mutation variables, rather than mutable navigation state, survive retries.
      const response =
        typeof visit === "number"
          ? await recordBusinessProfileVisit(visit)
          : await recordBusinessProfileVisit(
              visit.businessId,
              visit.discoverySource,
            );
      return throwOnApiError(response);
    },
    retry: retryVisibility,
    retryDelay: 1000,
    networkMode: "always",
    throwOnError: false,
  });
}
