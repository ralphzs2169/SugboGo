import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type {
  MapBounds,
  MapDiscoveryResponse,
} from "../types/mapDiscovery.types";
import { isSearchableBounds } from "../utils/mapViewport";

export async function getMapDiscoveryBusinesses(
  bounds: MapBounds,
  signal?: AbortSignal,
): Promise<ApiResponse<MapDiscoveryResponse>> {
  if (!isSearchableBounds(bounds)) {
    throw new Error("Zoom in to search this area.");
  }

  return request(
    apiClient.get("/explorer/explore/map/", {
      params: {
        ...bounds,
        page: 1,
        page_size: 200,
      },
      signal,
    }),
  );
}
