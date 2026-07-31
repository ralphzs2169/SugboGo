import { PlaceSuggestion } from "../types/BusinessLocation.types";
import apiClient from "./apiClient.service";
import {
  NearbyLandmark,
  BusinessLocation,
} from "../types/BusinessLocation.types";
/**
 * Searches for business location suggestions through the
 * SugboGo backend location service.
 */
export async function searchPlaces(input: string): Promise<PlaceSuggestion[]> {
  const response = await apiClient.post("/registration/places/search/", {
    input,
  });

  return response.data.data.suggestions;
}

/**
 * Retrieves the coordinates and structured address details
 * for a selected place through the SugboGo backend.
 */
export async function getPlaceDetails(
  placeId: string,
): Promise<BusinessLocation> {
  const response = await apiClient.post("/registration/places/details/", {
    place_id: placeId,
  });

  return response.data.data.location;
}

/**
 * Resolves geographic coordinates into structured address
 * details through the SugboGo backend.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<BusinessLocation> {
  const response = await apiClient.post("/registration/reverse-geocode/", {
    latitude,
    longitude,
  });

  return {
    latitude,
    longitude,
    ...response.data.data.address,
  };
}

export async function searchNearbyLandmarksService(
  latitude: number,
  longitude: number,
): Promise<NearbyLandmark[]> {
  const response = await apiClient.post("/registration/nearby-landmarks/", {
    latitude,
    longitude,
  });

  return response.data.data.landmarks;
}
