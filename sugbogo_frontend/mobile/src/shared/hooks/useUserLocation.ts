import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useCallback, useEffect, useReducer, useState } from "react";

export const USER_LOCATION_QUERY_KEY = ["user-location"] as const;
const LOCATION_ACQUISITION_QUERY_KEY = ["user-location-acquisition"] as const;
export const RECENT_LOCATION_MAX_AGE_MS = 2 * 60_000;

type LocationMode = "current" | "recent" | "cached";

export type UserLocationStatus =
  "loading" | "available" | "denied" | "unavailable";

type UserLocationResult =
  | {
      status: "available";
      location: Location.LocationObject;
      error: null;
    }
  | {
      status: "denied";
      location: null;
      error: null;
    }
  | {
      status: "unavailable";
      location: null;
      error: unknown;
    };

function isRecent(location: Location.LocationObject) {
  const age = Date.now() - location.timestamp;
  return age >= 0 && age < RECENT_LOCATION_MAX_AGE_MS;
}

async function requestCurrentLocation(): Promise<UserLocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== Location.PermissionStatus.GRANTED) {
      return {
        status: "denied",
        location: null,
        error: null,
      };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      status: "available",
      location,
      error: null,
    };
  } catch (error) {
    return {
      status: "unavailable",
      location: null,
      error,
    };
  }
}

/**
 * Provides optional access to the user's current device location.
 *
 * Current mode preserves fresh-on-mount navigation reads. Recent mode reuses
 * timestamp-bounded fixes; cached mode checks permission without acquiring GPS.
 * Acquisition is shared in the session's non-persisted QueryClient cache.
 */
export default function useUserLocation({
  enabled = true,
  mode = "current",
}: {
  enabled?: boolean;
  mode?: LocationMode;
} = {}) {
  const client = useQueryClient();
  const [currentResult, setCurrentResult] = useState<UserLocationResult | null>(
    null,
  );
  const [isRefreshingCurrent, setIsRefreshingCurrent] = useState(enabled);
  const [, recheckAge] = useReducer((value: number) => value + 1, 0);
  const isAcquiring =
    useIsFetching({ queryKey: LOCATION_ACQUISITION_QUERY_KEY }) > 0;
  const acquireLocation = useCallback(
    () =>
      client.fetchQuery({
        queryKey: LOCATION_ACQUISITION_QUERY_KEY,
        queryFn: requestCurrentLocation,
        networkMode: "always",
        retry: false,
        staleTime: 0,
      }),
    [client],
  );
  const getRecentLocation = useCallback(() => {
    const cached = client.getQueryData<UserLocationResult>(
      USER_LOCATION_QUERY_KEY,
    );
    return cached?.status === "available" && isRecent(cached.location)
      ? cached.location
      : null;
  }, [client]);
  const query = useQuery({
    queryKey: USER_LOCATION_QUERY_KEY,
    queryFn: async (): Promise<UserLocationResult> => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        // Passive resume checks must not repeat a previously denied prompt.
        // Explicit refresh still requests permission through acquireLocation.
        if (permission.status === Location.PermissionStatus.DENIED) {
          return { status: "denied", location: null, error: null };
        }
        if (permission.status !== Location.PermissionStatus.GRANTED) {
          return acquireLocation();
        }
        const location = getRecentLocation();
        return location
          ? { status: "available", location, error: null }
          : acquireLocation();
      } catch (error) {
        return { status: "unavailable", location: null, error };
      }
    },
    enabled: enabled && mode === "recent",
    networkMode: "always",
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: mode === "recent" ? "always" : false,
    refetchOnReconnect: false,
  });
  const permission = useQuery({
    queryKey: ["user-location-permission"],
    queryFn: () => Location.getForegroundPermissionsAsync(),
    enabled: enabled && mode === "cached",
    networkMode: "always",
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: false,
  });

  const denied =
    mode === "cached" &&
    permission.isFetchedAfterMount &&
    permission.data?.status !== undefined &&
    permission.data.status !== Location.PermissionStatus.GRANTED;
  useEffect(() => {
    if (enabled && denied) {
      client.setQueryData<UserLocationResult>(USER_LOCATION_QUERY_KEY, {
        status: "denied",
        location: null,
        error: null,
      });
    }
  }, [client, denied, enabled]);

  const result = mode === "current" ? currentResult : query.data;
  const snapshot = result?.location;
  useEffect(() => {
    if (!enabled || mode === "current" || !snapshot || !isRecent(snapshot))
      return;
    const timeout = setTimeout(
      recheckAge,
      snapshot.timestamp + RECENT_LOCATION_MAX_AGE_MS - Date.now(),
    );
    return () => clearTimeout(timeout);
  }, [enabled, mode, snapshot]);

  const refreshLocation = useCallback(async () => {
    if (!enabled) {
      return { status: "unavailable", location: null, error: null } as const;
    }
    if (mode === "current") setIsRefreshingCurrent(true);
    try {
      const fetched = await acquireLocation();
      client.setQueryData(USER_LOCATION_QUERY_KEY, fetched);
      if (mode === "current") setCurrentResult(fetched);
      if (
        mode !== "current" &&
        fetched.status === "available" &&
        !isRecent(fetched.location)
      ) {
        return { status: "unavailable", location: null, error: null } as const;
      }
      return fetched;
    } finally {
      if (mode === "current") setIsRefreshingCurrent(false);
    }
  }, [acquireLocation, client, enabled, mode]);

  useEffect(() => {
    // Navigation workflows keep their own one-time origin until explicitly refreshed.
    if (enabled && mode === "current")
      void refreshLocation().catch(() => undefined);
  }, [enabled, mode, refreshLocation]);

  const canRead =
    mode !== "cached"
      ? mode === "current" || query.isFetchedAfterMount
      : permission.isFetchedAfterMount &&
        !permission.isFetching &&
        !permission.isError &&
        permission.data?.status === Location.PermissionStatus.GRANTED;
  const location =
    enabled && canRead && snapshot && (mode === "current" || isRecent(snapshot))
      ? snapshot
      : null;
  const isRefreshingLocation =
    enabled &&
    (mode === "current"
      ? isRefreshingCurrent
      : mode === "cached"
        ? permission.isFetching
        : query.isFetching || isAcquiring);
  const status: UserLocationStatus = !enabled
    ? "unavailable"
    : isRefreshingLocation
      ? "loading"
      : denied || result?.status === "denied"
        ? "denied"
        : location
          ? "available"
          : "unavailable";

  return {
    location,
    latitude: location?.coords.latitude ?? null,
    longitude: location?.coords.longitude ?? null,
    accuracy: location?.coords.accuracy ?? null,
    status,
    error: enabled
      ? (result?.error ?? (mode === "cached" ? permission.error : null))
      : null,
    isRefreshingLocation,
    refreshLocation,
  };
}
