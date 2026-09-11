import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";

/**
 * Provides optional access to the user's current device location.
 *
 * Requests foreground location permission on initial use and supports manually
 * refreshing the location without requiring continuous location tracking.
 */
export default function useUserLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [isRefreshingLocation, setIsRefreshingLocation] = useState(false);

  const refreshLocation = useCallback(async () => {
    setIsRefreshingLocation(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== Location.PermissionStatus.GRANTED) {
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation(currentLocation);
    } catch {
      // Location is optional and should not prevent the UI from loading.
    } finally {
      setIsRefreshingLocation(false);
    }
  }, []);

  useEffect(() => {
    void refreshLocation();
  }, [refreshLocation]);

  return {
    location,
    latitude: location?.coords.latitude ?? null,
    longitude: location?.coords.longitude ?? null,
    accuracy: location?.coords.accuracy ?? null,
    isRefreshingLocation,
    refreshLocation,
  };
}
