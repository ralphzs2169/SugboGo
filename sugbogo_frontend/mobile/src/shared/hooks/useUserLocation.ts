import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";

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
 * Requests foreground location permission on initial use and supports manually
 * refreshing the location without requiring continuous location tracking.
 */
export default function useUserLocation({ enabled = true } = {}) {
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [status, setStatus] = useState<UserLocationStatus>(
    enabled ? "loading" : "unavailable",
  );
  const [error, setError] = useState<unknown>(null);
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(enabled);

  const refreshLocation = useCallback(async () => {
    if (!enabled) {
      return {
        status: "unavailable",
        location: null,
        error: null,
      } as const;
    }
    setIsRefreshingLocation(true);
    setStatus("loading");
    setError(null);

    const result = await requestCurrentLocation();

    setLocation(result.location);
    setStatus(result.status);
    setError(result.error);
    setIsRefreshingLocation(false);

    return result;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isActive = true;

    void requestCurrentLocation().then((result) => {
      if (!isActive) {
        return;
      }

      setLocation(result.location);
      setStatus(result.status);
      setError(result.error);
      setIsRefreshingLocation(false);
    });

    return () => {
      isActive = false;
    };
  }, [enabled]);

  return {
    location: enabled ? location : null,
    latitude: enabled ? (location?.coords.latitude ?? null) : null,
    longitude: enabled ? (location?.coords.longitude ?? null) : null,
    accuracy: enabled ? (location?.coords.accuracy ?? null) : null,
    status: enabled ? status : ("unavailable" as const),
    error: enabled ? error : null,
    isRefreshingLocation: enabled && isRefreshingLocation,
    refreshLocation,
  };
}
