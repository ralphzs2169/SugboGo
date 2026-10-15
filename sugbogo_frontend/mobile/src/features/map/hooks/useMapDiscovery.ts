import { useQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getMapDiscoveryBusinesses } from "../api/mapDiscovery.service";
import type { MapBounds } from "../types/mapDiscovery.types";
import { isSearchableBounds, normalizeBounds } from "../utils/mapViewport";

export const MAP_DISCOVERY_QUERY_KEY = ["map-discovery"] as const;

/** Loads a bounded first page only when the screen commits valid map bounds. */
export default function useMapDiscovery(bounds: MapBounds | null) {
  const requestedBounds = bounds ? normalizeBounds(bounds) : null;
  const query = useQuery({
    queryKey: [...MAP_DISCOVERY_QUERY_KEY, requestedBounds],
    enabled: requestedBounds !== null && isSearchableBounds(requestedBounds),
    queryFn: async ({ signal }) => {
      if (!requestedBounds || !isSearchableBounds(requestedBounds)) {
        throw new Error("Zoom in to search this area.");
      }

      return throwOnApiError(
        await getMapDiscoveryBusinesses(requestedBounds, signal),
      );
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return {
    businesses: query.data?.items ?? [],
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
