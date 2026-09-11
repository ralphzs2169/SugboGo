import { useQuery } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getMapPreviewBusinesses } from "../api/exploreBusiness.service";

export const MAP_PREVIEW_QUERY_KEY = ["explore-map-preview"] as const;

/**
 * Loads nearby business markers for the Explore map preview.
 *
 * The query remains disabled until device coordinates are available and
 * automatically creates a location-specific cache entry for nearby markers.
 */
export default function useMapPreviewBusinesses(
  latitude: number | null,
  longitude: number | null,
) {
  const hasLocation = latitude !== null && longitude !== null;

  const query = useQuery({
    queryKey: [...MAP_PREVIEW_QUERY_KEY, latitude, longitude],
    enabled: hasLocation,
    queryFn: async () => {
      if (!hasLocation) {
        return [];
      }

      const response = await getMapPreviewBusinesses(latitude, longitude);

      return throwOnApiError(response);
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    businesses: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}
