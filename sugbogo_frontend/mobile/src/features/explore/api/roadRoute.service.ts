import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type { RoadRouteSearchResult } from "../types/roadRoute.types";

export async function getRoadRoute(
  businessId: number,
  latitude: number,
  longitude: number,
): Promise<ApiResponse<RoadRouteSearchResult>> {
  return request(
    apiClient.get(
      `/explorer/explore/businesses/${businessId}/road-route/`,
      {
        params: {
          latitude,
          longitude,
        },
      },
    ),
  );
}
