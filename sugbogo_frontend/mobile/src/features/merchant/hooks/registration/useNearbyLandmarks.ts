import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { searchNearbyLandmarksService } from "@/shared/api/googlePlaces.service";
import type { BusinessLandmark } from "@/shared/types/BusinessLocation.types";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { merchantApplicationKeys } from "../merchantApplicationQueryKeys";

const NEARBY_LANDMARKS_STALE_TIME = 5 * 60 * 1000;

function hasValidCoordinate(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

async function fetchNearbyLandmarks(
  latitude: number,
  longitude: number,
): Promise<BusinessLandmark[]> {
  const response = await searchNearbyLandmarksService(latitude, longitude);
  const data = throwOnApiError(response);
  const landmarks: BusinessLandmark[] = [];

  for (const landmark of data.landmarks) {
    if (!landmark.placeId) {
      continue;
    }

    landmarks.push({
      id: landmark.placeId,
      name: landmark.name,
      address: landmark.address,
      latitude: landmark.latitude,
      longitude: landmark.longitude,
      source: "google",
      placeId: landmark.placeId,
    });
  }

  return landmarks;
}

/**
 * Manages nearby landmark suggestions for a selected business location.
 *
 * Fetches nearby places from the backend using the selected coordinates
 * and converts the API response into the BusinessLandmark model used
 * throughout the merchant registration flow.
 */
export default function useNearbyLandmarks(
  latitude: number | null = null,
  longitude: number | null = null,
) {
  const queryClient = useQueryClient();
  const hasCoordinates =
    hasValidCoordinate(latitude) && hasValidCoordinate(longitude);

  const query = useQuery<BusinessLandmark[], ApiError>({
    queryKey: merchantApplicationKeys.nearbyLandmarks(latitude, longitude),
    queryFn: async () => {
      if (!hasCoordinates) {
        throw new Error("Nearby-landmark coordinates are unavailable.");
      }

      return fetchNearbyLandmarks(latitude, longitude);
    },
    enabled: hasCoordinates,
    staleTime: NEARBY_LANDMARKS_STALE_TIME,
    retry: false,
  });

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
      try {
        const landmarks = await queryClient.fetchQuery({
          queryKey: merchantApplicationKeys.nearbyLandmarks(
            latitude,
            longitude,
          ),
          queryFn: () => fetchNearbyLandmarks(latitude, longitude),
          staleTime: NEARBY_LANDMARKS_STALE_TIME,
          retry: false,
        });

        return {
          success: true,
          landmarks,
        };
      } catch (error) {
        const response = error as ApiError | null;

        if (response?.success === false) {
          if (response.code !== "RATE_LIMIT_EXCEEDED") {
            handleSystemError(response);
          }

          return {
            success: false,
            landmarks: [],
          };
        }

        console.error("Failed to load nearby landmarks:", error);

        return {
          success: false,
          landmarks: [],
        };
      }
    },
    [queryClient],
  );

  /**
   * Clears the current nearby landmark suggestions.
   */
  const clearLandmarks = useCallback(() => {
    if (!hasCoordinates) {
      return;
    }

    queryClient.setQueryData<BusinessLandmark[]>(
      merchantApplicationKeys.nearbyLandmarks(latitude, longitude),
      [],
    );
  }, [hasCoordinates, latitude, longitude, queryClient]);

  return {
    landmarks: query.data ?? [],
    isLoadingLandmarks: query.isLoading,
    isFetchingLandmarks: query.isFetching,
    isRefetchingLandmarks: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
    searchNearbyLandmarks,
    clearLandmarks,
  };
}
