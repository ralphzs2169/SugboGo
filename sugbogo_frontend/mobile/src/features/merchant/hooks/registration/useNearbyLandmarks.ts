import { useState } from "react";

import { searchNearbyLandmarksService } from "@/shared/api/googlePlaces.service";
import { NearbyLandmark } from "@/shared/types/BusinessLocation.types";

/**
 * Manages nearby landmark suggestions for a selected business location.
 *
 * Fetches nearby places from the backend using the selected coordinates
 * and provides helpers for clearing the current suggestions.
 */
export default function useNearbyLandmarks() {
  const [landmarks, setLandmarks] = useState<NearbyLandmark[]>([]);
  const [isLoadingLandmarks, setIsLoadingLandmarks] = useState(false);

  /**
   * Retrieves nearby landmarks for the provided coordinates.
   */
  async function searchNearbyLandmarks(latitude: number, longitude: number) {
    setIsLoadingLandmarks(true);

    try {
      // Request nearby landmark suggestions from the backend.
      const results = await searchNearbyLandmarksService(latitude, longitude);

      setLandmarks(results);
    } catch (error) {
      // Keep the location flow usable even when landmark lookup fails.
      console.error("Failed to load nearby landmarks:", error);
      setLandmarks([]);
    } finally {
      setIsLoadingLandmarks(false);
    }
  }

  function clearLandmarks() {
    setLandmarks([]);
  }

  return {
    landmarks,
    isLoadingLandmarks,
    searchNearbyLandmarks,
    clearLandmarks,
  };
}
