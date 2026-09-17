import type {
  BusinessLocationAddress,
  GooglePlaceLocation,
  PlaceSuggestion,
} from "@/shared/types/BusinessLocation.types";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";

/** Searches for journey origins within the managed Cebu transit extent. */
export function searchJourneyOriginPlaces(
  input: string,
): Promise<ApiResponse<{ suggestions: PlaceSuggestion[] }>> {
  return request(
    apiClient.post<ApiResponse<{ suggestions: PlaceSuggestion[] }>>(
      "/explorer/explore/journey-origins/places/search/",
      {
        input,
      },
    ),
  );
}

/** Resolves provider details for a selected journey-origin suggestion. */
export function getJourneyOriginPlaceDetails(
  placeId: string,
): Promise<ApiResponse<{ location: GooglePlaceLocation }>> {
  return request(
    apiClient.post<ApiResponse<{ location: GooglePlaceLocation }>>(
      "/explorer/explore/journey-origins/places/details/",
      {
        place_id: placeId,
      },
    ),
  );
}

/** Resolves a readable address for journey-origin coordinates. */
export function reverseGeocodeJourneyOrigin(
  latitude: number,
  longitude: number,
): Promise<ApiResponse<{ address: BusinessLocationAddress }>> {
  return request(
    apiClient.post<ApiResponse<{ address: BusinessLocationAddress }>>(
      "/explorer/explore/journey-origins/reverse-geocode/",
      {
        latitude,
        longitude,
      },
    ),
  );
}
