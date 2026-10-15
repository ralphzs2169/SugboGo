import { useQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getMapDiscoveryBusinesses } from "../api/mapDiscovery.service";
import {
  DEFAULT_MAP_FILTERS,
  type MapBounds,
  type MapDiscoveryFilters,
} from "../types/mapDiscovery.types";
import { isSearchableBounds, normalizeBounds } from "../utils/mapViewport";

export const MAP_DISCOVERY_QUERY_KEY = ["map-discovery"] as const;

/** Loads a bounded first page only when the screen commits valid map bounds. */
export default function useMapDiscovery(
  bounds: MapBounds | null,
  filters: MapDiscoveryFilters = DEFAULT_MAP_FILTERS,
) {
  const requestedBounds = bounds ? normalizeBounds(bounds) : null;
  const normalizedFilters = {
    ...filters,
    categoryIds: [...new Set(filters.categoryIds)].sort(
      (left, right) => left - right,
    ),
  };
  const query = useQuery({
    queryKey: [...MAP_DISCOVERY_QUERY_KEY, requestedBounds, normalizedFilters],
    enabled: requestedBounds !== null && isSearchableBounds(requestedBounds),
    queryFn: async ({ signal }) => {
      if (!requestedBounds || !isSearchableBounds(requestedBounds)) {
        throw new Error("Zoom in to search this area.");
      }

      return throwOnApiError(
        await getMapDiscoveryBusinesses(
          requestedBounds,
          signal,
          normalizedFilters,
        ),
      );
    },
    staleTime: filters.openNow ? 30_000 : 5 * 60 * 1000,
    refetchInterval: (currentQuery) =>
      filters.openNow && currentQuery.state.status !== "error" ? 60_000 : false,
    refetchOnWindowFocus: (currentQuery) =>
      filters.openNow && currentQuery.state.status !== "error",
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
