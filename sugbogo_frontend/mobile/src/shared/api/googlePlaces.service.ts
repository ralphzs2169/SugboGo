import { PlaceSuggestion } from "../types/BusinessLocation.types";
import { ApiResponse } from "../types/apiResponse.types";
import { request } from "./request.service";
import apiClient from "./apiClient.service";
import {
  BusinessLandmark,
  BusinessLocation,
} from "../types/BusinessLocation.types";

/**
 * Searches for business location suggestions through the
 * SugboGo backend location service.
 */
export function searchPlaces(
  input: string,
): Promise<ApiResponse<{ suggestions: PlaceSuggestion[] }>> {
  return request(
    apiClient.post<ApiResponse<{ suggestions: PlaceSuggestion[] }>>(
      "/merchant/application/places/search/",
      { input },
    ),
  );
}

/**
 * Retrieves the coordinates and structured address details
 * for a selected place through the SugboGo backend.
 */
export function getPlaceDetails(
  placeId: string,
): Promise<ApiResponse<{ location: BusinessLocation }>> {
  return request(
    apiClient.post<ApiResponse<{ location: BusinessLocation }>>(
      "/merchant/application/places/details/",
      { place_id: placeId },
    ),
  );
}

/**
 * Resolves geographic coordinates into structured address
 * details through the SugboGo backend.
 */
export function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<
  ApiResponse<{ address: Omit<BusinessLocation, "latitude" | "longitude"> }>
> {
  return request(
    apiClient.post<
      ApiResponse<{
        address: Omit<BusinessLocation, "latitude" | "longitude">;
      }>
    >("/merchant/application/reverse-geocode/", {
      latitude,
      longitude,
    }),
  );
}

/**
 * Retrieves nearby landmarks for the given geographic coordinates.
 */
export function searchNearbyLandmarksService(
  latitude: number,
  longitude: number,
): Promise<ApiResponse<{ landmarks: BusinessLandmark[] }>> {
  return request(
    apiClient.post<ApiResponse<{ landmarks: BusinessLandmark[] }>>(
      "/merchant/application/nearby-landmarks/",
      {
        latitude,
        longitude,
      },
    ),
  );
}
