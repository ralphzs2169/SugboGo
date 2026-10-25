import { onlineManager, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LocationObject } from "expo-location";
import { useIsFocused } from "expo-router";
import { useCallback, useEffect } from "react";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import { getOpenNowBusinesses } from "../api/exploreBusiness.service";
import { OPEN_NOW_BUSINESSES_QUERY_KEY } from "../constants/exploreHomepageQueries";

/** Builds location-specific queries without persisting time-sensitive availability. */
function openNowQueryOptions(location: LocationObject | null) {
  const latitude = location?.coords.latitude ?? null;
  const longitude = location?.coords.longitude ?? null;

  return {
    queryKey: [...OPEN_NOW_BUSINESSES_QUERY_KEY, latitude, longitude],
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      if (latitude === null || longitude === null) {
        return [];
      }

      return throwOnApiError(
        await getOpenNowBusinesses(latitude, longitude, signal),
      );
    },
    staleTime: 30_000,
    retry: false,
  };
}

/**
 * Loads nearby open businesses in backend order for the selected location.
 *
 * Refreshes on screen return and every minute while focused, and supports
 * explicit refreshes using newly resolved coordinates rather than stale state.
 */
export default function useOpenNowBusinesses(
  location: LocationObject | null,
  enabled = true,
) {
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const query = useQuery({
    ...openNowQueryOptions(location),
    enabled: enabled && isFocused && location !== null,
    refetchInterval: enabled && isFocused ? 60_000 : false,
    refetchOnWindowFocus: "always",
  });

  useEffect(() => {
    if (isFocused) {
      void queryClient.invalidateQueries({
        queryKey: OPEN_NOW_BUSINESSES_QUERY_KEY,
      });
    }
  }, [isFocused, queryClient]);

  const refreshAtLocation = useCallback(
    async (nextLocation: LocationObject) => {
      // Let the observer expose a paused state instead of awaiting connectivity.
      if (!onlineManager.isOnline()) {
        return;
      }

      await queryClient.fetchQuery({
        ...openNowQueryOptions(nextLocation),
        staleTime: 0,
      });
    },
    [queryClient],
  );

  return {
    businesses: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isPaused: query.isPaused,
    error: query.error,
    refetch: query.refetch,
    refreshAtLocation,
  };
}
