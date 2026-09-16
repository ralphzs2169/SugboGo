import { useQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getDirectJourneys } from "../api/directJourney.service";

export const DIRECT_JOURNEYS_QUERY_KEY = ["direct-journeys"] as const;

export function directJourneysQueryKey(
  businessId: number,
  latitude: number | null,
  longitude: number | null,
) {
  return [
    ...DIRECT_JOURNEYS_QUERY_KEY,
    businessId,
    latitude,
    longitude,
  ] as const;
}

/** Loads backend-ranked direct jeepney journeys once location is available. */
export default function useDirectJourneys(
  businessId: number,
  latitude: number | null,
  longitude: number | null,
) {
  const hasCoordinates = latitude !== null && longitude !== null;

  const query = useQuery({
    queryKey: directJourneysQueryKey(businessId, latitude, longitude),
    queryFn: async () => {
      if (!businessId || latitude === null || longitude === null) {
        throw new Error("Direct journey coordinates are unavailable.");
      }

      const response = await getDirectJourneys(
        businessId,
        latitude,
        longitude,
      );

      return throwOnApiError(response);
    },
    enabled: Boolean(businessId) && hasCoordinates,
  });

  return {
    result: query.data ?? null,
    routeOptions: query.data?.route_options ?? [],
    reason: query.data?.reason ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
