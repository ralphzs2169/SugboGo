import { useCallback, useState } from "react";

import { searchNearbyLandmarksService } from "@/shared/api/googlePlaces.service";
import { BusinessLandmark } from "@/shared/types/BusinessLocation.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

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
    ): Promise<{
      success: boolean;
      landmarks: BusinessLandmark[];
    }> => {
      setIsLoadingLandmarks(true);

      try {
        const response = await searchNearbyLandmarksService(
          latitude,
          longitude,
        );

        if (!response.success) {
          if (response.code === "RATE_LIMIT_EXCEEDED") {
            setLandmarks([]);
            return {
              success: false,
              landmarks: [],
            };
          }

          handleSystemError(response);

          setLandmarks([]);
          return {
            success: false,
            landmarks: [],
          };
        }

        const mappedLandmarks: BusinessLandmark[] = [];

        for (const landmark of response.data.landmarks) {
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

        return {
          success: true,
          landmarks: mappedLandmarks,
        };
      } catch (error) {
        console.error("Failed to load nearby landmarks:", error);

        setLandmarks([]);
        return {
          success: false,
          landmarks: [],
        };
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
