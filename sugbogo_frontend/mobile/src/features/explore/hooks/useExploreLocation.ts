import * as Location from "expo-location";
import { useEffect, useState } from "react";

/** Loads optional device location for informational business distances. */
export default function useExploreLocation() {
  const [userLocation, setUserLocation] =
    useState<Location.LocationObject | null>(null);

  useEffect(() => {
    const loadLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== Location.PermissionStatus.GRANTED) {
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setUserLocation(location);
    };

    void loadLocation();
  }, []);

  return userLocation;
}
