import {
  focusManager,
  hashKey,
  onlineManager,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { LocationObject } from "expo-location";
import { useIsFocused } from "expo-router";
import { useCallback, useEffect, useState } from "react";

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
  const [failedRefresh, setFailedRefresh] = useState<string | null>(null);
  const query = useQuery({
    ...openNowQueryOptions(location),
    enabled: (current) =>
      enabled &&
      isFocused &&
      location !== null &&
      !(failedRefresh === current.queryHash && current.state.error !== null),
    refetchInterval: enabled && isFocused ? 60_000 : false,
    refetchOnWindowFocus: "always",
  });

  useEffect(() => {
    if (isFocused) {
      setFailedRefresh(null);
      void queryClient.invalidateQueries({
        queryKey: OPEN_NOW_BUSINESSES_QUERY_KEY,
      });
    }
  }, [isFocused, queryClient]);

  useEffect(() => {
    if (!failedRefresh || !enabled || !isFocused) return;
    // Retain Retry and the normal minute cadence, without retrying on re-enable.
    const timeout = setTimeout(() => setFailedRefresh(null), 60_000);
    const unsubscribe = focusManager.subscribe((focused) => {
      if (focused) setFailedRefresh(null);
    });
    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [enabled, failedRefresh, isFocused]);

  const refreshAtLocation = useCallback(
    async (nextLocation: LocationObject) => {
      // Let the observer expose a paused state instead of awaiting connectivity.
      if (!onlineManager.isOnline()) {
        return;
      }

      const options = openNowQueryOptions(nextLocation);
      try {
        await queryClient.fetchQuery({
          ...options,
          staleTime: 0,
        });
      } catch (error) {
        setFailedRefresh(hashKey(options.queryKey));
        throw error;
      }
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
