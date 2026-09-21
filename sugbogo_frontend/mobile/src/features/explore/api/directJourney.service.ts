import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  DirectJourneyMapResult,
  DirectJourneySearchResult,
} from "../types/directJourney.types";

export async function getDirectJourneys(
  businessId: number,
  latitude: number,
  longitude: number,
): Promise<ApiResponse<DirectJourneySearchResult>> {
  return request(
    apiClient.get(
      `/explorer/explore/businesses/${businessId}/direct-journeys/`,
      {
        params: {
          latitude,
          longitude,
        },
      },
    ),
  );
}

export async function getDirectJourneyMap(
  businessId: number,
  routeVariantId: number,
  boardingTransitPointId: number,
  alightingTransitPointId: number,
): Promise<ApiResponse<DirectJourneyMapResult>> {
  return request(
    apiClient.get(
      `/explorer/explore/businesses/${businessId}/direct-journeys/map/`,
      {
        params: {
          route_variant_id: routeVariantId,
          boarding_transit_point_id: boardingTransitPointId,
          alighting_transit_point_id: alightingTransitPointId,
        },
      },
    ),
  );
}
