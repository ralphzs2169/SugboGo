import { useCallback, useState } from "react";

import { searchNearbyLandmarksService } from "@/shared/api/googlePlaces.service";
import { BusinessLandmark } from "@/shared/types/BusinessLocation.types";

/**
 * Manages nearby landmark suggestions for a selected business location.
 *
 * Fetches nearby places from the backend using the selected coordinates
 * and converts the API response into the BusinessLandmark model used
 * throughout the merchant registration flow.
 */
export default function useNearbyLandmarks() {
  const [landmarks, setLandmarks] = useState<BusinessLandmark[]>([]);
  const [isLoadingLandmarks, setIsLoadingLandmarks] = useState(false);

  /**
   * Retrieves nearby landmark suggestions for the provided coordinates.
   */
  const searchNearbyLandmarks = useCallback(
    async (
      latitude: number,
      longitude: number,
    ): Promise<BusinessLandmark[]> => {
      setIsLoadingLandmarks(true);

      try {
        const results = await searchNearbyLandmarksService(latitude, longitude);

        const mappedLandmarks: BusinessLandmark[] = [];

        for (const landmark of results) {
          if (!landmark.placeId) {
            continue;
          }

          mappedLandmarks.push({
            id: landmark.placeId,
            name: landmark.name,
            address: landmark.address,
            latitude: landmark.latitude,
            longitude: landmark.longitude,
            source: "google",
            placeId: landmark.placeId,
          });
        }

        setLandmarks(mappedLandmarks);
        return mappedLandmarks;
      } catch (error) {
        console.error("Failed to load nearby landmarks:", error);

        setLandmarks([]);
        return [];
      } finally {
        setIsLoadingLandmarks(false);
      }
    },
    [],
  );

  /**
   * Clears the current nearby landmark suggestions.
   */
  const clearLandmarks = useCallback(() => {
    setLandmarks([]);
  }, []);

  return {
    landmarks,
    isLoadingLandmarks,
    searchNearbyLandmarks,
    clearLandmarks,
  };
}
