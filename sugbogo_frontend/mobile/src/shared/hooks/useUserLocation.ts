import * as Location from "expo-location";
import { useEffect, useState } from "react";

/**
 * Custom hook to retrieve the user's current location.
 * Location access is optional and should not prevent the UI from loading.
 * Returns the location object and its latitude, longitude, and accuracy.
 */
export default function useUserLocation() {
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;

    const loadLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== Location.PermissionStatus.GRANTED || !isMounted) {
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (isMounted) {
          setLocation(currentLocation);
        }
      } catch {
        // Location is optional and should not prevent the UI from loading.
      }
    };

    loadLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    location,
    latitude: location?.coords.latitude ?? null,
    longitude: location?.coords.longitude ?? null,
    accuracy: location?.coords.accuracy ?? null,
  };
}
