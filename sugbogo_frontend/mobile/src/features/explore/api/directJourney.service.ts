import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type { DirectJourneySearchResult } from "../types/directJourney.types";

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
