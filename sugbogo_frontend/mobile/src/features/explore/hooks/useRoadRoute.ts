import { useQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getRoadRoute } from "../api/roadRoute.service";

export const ROAD_ROUTE_QUERY_KEY = ["road-route"] as const;

export function roadRouteQueryKey(
  businessId: number,
  latitude: number | null,
  longitude: number | null,
) {
  return [
    ...ROAD_ROUTE_QUERY_KEY,
    businessId,
    latitude,
    longitude,
  ] as const;
}

/** Loads one backend-owned road route after current coordinates are available. */
export default function useRoadRoute(
  businessId: number,
  latitude: number | null,
  longitude: number | null,
) {
  const hasCoordinates = latitude !== null && longitude !== null;

  const query = useQuery({
    queryKey: roadRouteQueryKey(businessId, latitude, longitude),
    queryFn: async () => {
      if (!businessId || latitude === null || longitude === null) {
        throw new Error("Road route coordinates are unavailable.");
      }

      const response = await getRoadRoute(
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
    route: query.data?.route ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
